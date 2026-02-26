import { useState, useCallback, useMemo, useEffect } from 'react';
import { getContract, MOTOSWAP_ROUTER_ABI, OP_20_ABI, MotoSwapFactoryAbi, MotoswapPoolAbi } from 'opnet';
import type { BitcoinInterfaceAbi, CallResult } from 'opnet';
import { Address } from '@btc-vision/transaction';
import { useWallet } from './useWallet';
import { broadcastCall, ensureAllowance } from '../services/TransactionService';
import { MOTOSWAP_ROUTER, MOTOSWAP_FACTORY, MOTO_TOKEN } from '../config/dex';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyContract = any;

const POLL_INTERVAL = 30_000;

export interface DexState {
  readonly motoBalance: bigint;
  readonly tokenBalance: bigint;
  readonly buyQuote: bigint;
  readonly sellQuote: bigint;
  readonly loading: boolean;
  readonly busy: boolean;
}

/**
 * Hook for Buy / Sell / Add-Liquidity for any token paired with MOTO
 * via the MotoSwap router.
 */
export function useDexActions(tokenAddr: string) {
  const { provider, network, address, walletAddress, connected } = useWallet();
  const [motoBalance, setMotoBalance] = useState(0n);
  const [tokenBalance, setTokenBalance] = useState(0n);
  const [buyQuote, setBuyQuote] = useState(0n);
  const [sellQuote, setSellQuote] = useState(0n);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  // MOTO token contract
  const motoContract: AnyContract | null = useMemo(() => {
    if (!MOTO_TOKEN) return null;
    return getContract(MOTO_TOKEN, OP_20_ABI, provider, network, address ?? undefined);
  }, [provider, network, address]);

  // Target token contract
  const tokenContract: AnyContract | null = useMemo(() => {
    if (!tokenAddr) return null;
    return getContract(tokenAddr, OP_20_ABI, provider, network, address ?? undefined);
  }, [tokenAddr, provider, network, address]);

  // MotoSwap router
  const router: AnyContract | null = useMemo(() => {
    return getContract(
      MOTOSWAP_ROUTER,
      MOTOSWAP_ROUTER_ABI as unknown as BitcoinInterfaceAbi,
      provider,
      network,
      address ?? undefined,
    );
  }, [provider, network, address]);

  // MotoSwap factory (for pool lookup)
  const factory: AnyContract | null = useMemo(() => {
    return getContract(
      MOTOSWAP_FACTORY,
      MotoSwapFactoryAbi as unknown as BitcoinInterfaceAbi,
      provider,
      network,
      address ?? undefined,
    );
  }, [provider, network, address]);

  // Pool address + contract (resolved once)
  const [poolAddress, setPoolAddress] = useState<string | null>(null);
  const poolContract: AnyContract | null = useMemo(() => {
    if (!poolAddress) return null;
    return getContract(
      poolAddress,
      MotoswapPoolAbi as unknown as BitcoinInterfaceAbi,
      provider,
      network,
      address ?? undefined,
    );
  }, [poolAddress, provider, network, address]);

  // Reserves for LP ratio calculation
  const [reserves, setReserves] = useState<{ token: bigint; moto: bigint } | null>(null);
  const [, setTokenIsToken0] = useState(true);

  // Resolve pool address from factory
  useEffect(() => {
    if (!factory || !tokenAddr) { setPoolAddress(null); return; }
    (async () => {
      try {
        const res = await factory.getPool(
          Address.fromString(tokenAddr),
          Address.fromString(MOTO_TOKEN),
        );
        if (!res.revert) {
          const addr = res.properties.pool ?? res.properties.result;
          if (addr) setPoolAddress(addr.toString());
        }
      } catch {
        // pool doesn't exist yet
      }
    })();
  }, [factory, tokenAddr]);

  // Fetch reserves and determine token ordering
  const fetchReserves = useCallback(async () => {
    if (!poolContract) { setReserves(null); return; }
    try {
      const [reservesRes, token0Res] = await Promise.all([
        poolContract.getReserves(),
        poolContract.token0(),
      ]);
      if (reservesRes.revert || token0Res.revert) { setReserves(null); return; }
      const r0 = (reservesRes.properties.reserve0 ?? 0n) as bigint;
      const r1 = (reservesRes.properties.reserve1 ?? 0n) as bigint;
      const t0Addr = (token0Res.properties.token0 ?? '').toString().toLowerCase();
      const isToken0 = t0Addr === tokenAddr.toLowerCase();
      setTokenIsToken0(isToken0);
      setReserves({
        token: isToken0 ? r0 : r1,
        moto: isToken0 ? r1 : r0,
      });
    } catch {
      setReserves(null);
    }
  }, [poolContract, tokenAddr]);

  useEffect(() => {
    void fetchReserves();
  }, [fetchReserves]);

  /** Given one side of LP input, calculate the matching amount for the other side. */
  const getMatchingAmount = useCallback((inputAmount: bigint, inputIsToken: boolean): bigint => {
    if (!reserves || reserves.token === 0n || reserves.moto === 0n || inputAmount <= 0n) return 0n;
    if (inputIsToken) {
      // token amount given → calculate MOTO: (tokenAmount * motoReserve) / tokenReserve
      return (inputAmount * reserves.moto) / reserves.token;
    }
    // MOTO amount given → calculate token: (motoAmount * tokenReserve) / motoReserve
    return (inputAmount * reserves.token) / reserves.moto;
  }, [reserves]);

  // Fetch balances
  const fetchBalances = useCallback(async () => {
    if (!connected || !address) {
      setMotoBalance(0n);
      setTokenBalance(0n);
      setLoading(false);
      return;
    }
    try {
      const queries: Promise<AnyContract>[] = [];
      if (motoContract) queries.push(motoContract.balanceOf(address));
      if (tokenContract) queries.push(tokenContract.balanceOf(address));

      const results = await Promise.all(queries);
      let idx = 0;
      if (motoContract) {
        const res = results[idx++];
        if (!res.revert) setMotoBalance((res.properties.balance ?? res.properties.result ?? 0n) as bigint);
      }
      if (tokenContract) {
        const res = results[idx++];
        if (!res.revert) setTokenBalance((res.properties.balance ?? res.properties.result ?? 0n) as bigint);
      }
    } catch {
      // keep stale
    } finally {
      setLoading(false);
    }
  }, [motoContract, tokenContract, address, connected]);

  useEffect(() => {
    void fetchBalances();
    const interval = setInterval(() => void fetchBalances(), POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [fetchBalances]);

  // ── Quotes ──

  const getBuyQuote = useCallback(async (motoAmount: bigint): Promise<bigint> => {
    if (!router || !tokenAddr || motoAmount <= 0n) { setBuyQuote(0n); return 0n; }
    try {
      const res = await router.getAmountsOut(
        motoAmount,
        [Address.fromString(MOTO_TOKEN), Address.fromString(tokenAddr)],
      );
      if (res.revert) { setBuyQuote(0n); return 0n; }
      const amounts = res.properties.amountsOut ?? res.properties.amounts ?? res.properties.result;
      let out = 0n;
      if (Array.isArray(amounts) && amounts.length >= 2) out = BigInt(amounts[amounts.length - 1]);
      else if (typeof amounts === 'bigint') out = amounts;
      setBuyQuote(out);
      return out;
    } catch { setBuyQuote(0n); return 0n; }
  }, [router, tokenAddr]);

  const getSellQuote = useCallback(async (tokenAmount: bigint): Promise<bigint> => {
    if (!router || !tokenAddr || tokenAmount <= 0n) { setSellQuote(0n); return 0n; }
    try {
      const res = await router.getAmountsOut(
        tokenAmount,
        [Address.fromString(tokenAddr), Address.fromString(MOTO_TOKEN)],
      );
      if (res.revert) { setSellQuote(0n); return 0n; }
      const amounts = res.properties.amountsOut ?? res.properties.amounts ?? res.properties.result;
      let out = 0n;
      if (Array.isArray(amounts) && amounts.length >= 2) out = BigInt(amounts[amounts.length - 1]);
      else if (typeof amounts === 'bigint') out = amounts;
      setSellQuote(out);
      return out;
    } catch { setSellQuote(0n); return 0n; }
  }, [router, tokenAddr]);

  // ── Buy (MOTO → token) ──

  const buy = useCallback(async (motoAmount: bigint): Promise<string> => {
    if (!router || !motoContract || !address || !walletAddress || !tokenAddr) throw new Error('Not connected');
    setBusy(true);
    try {
      const approveResult = await ensureAllowance(motoContract, address, MOTOSWAP_ROUTER, motoAmount, walletAddress, network, provider);
      if (approveResult && !approveResult.success) throw new Error((approveResult as { error: string }).error);

      const deadline = BigInt(Math.floor(Date.now() / 1000) + 3600);
      const sim: CallResult = await router.swapExactTokensForTokensSupportingFeeOnTransferTokens(
        motoAmount, 0n,
        [Address.fromString(MOTO_TOKEN), Address.fromString(tokenAddr)],
        address, deadline,
      );
      const tx = await broadcastCall(sim, walletAddress, network, provider);
      if (!tx.success) throw new Error((tx as { error: string }).error);
      void fetchBalances();
      return (tx as { transactionId: string }).transactionId;
    } finally { setBusy(false); }
  }, [router, motoContract, address, walletAddress, tokenAddr, network, provider, fetchBalances]);

  // ── Sell (token → MOTO) ──

  const sell = useCallback(async (tokenAmount: bigint): Promise<string> => {
    if (!router || !tokenContract || !address || !walletAddress || !tokenAddr) throw new Error('Not connected');
    setBusy(true);
    try {
      const approveResult = await ensureAllowance(tokenContract, address, MOTOSWAP_ROUTER, tokenAmount, walletAddress, network, provider);
      if (approveResult && !approveResult.success) throw new Error((approveResult as { error: string }).error);

      const deadline = BigInt(Math.floor(Date.now() / 1000) + 3600);
      const sim: CallResult = await router.swapExactTokensForTokensSupportingFeeOnTransferTokens(
        tokenAmount, 0n,
        [Address.fromString(tokenAddr), Address.fromString(MOTO_TOKEN)],
        address, deadline,
      );
      const tx = await broadcastCall(sim, walletAddress, network, provider);
      if (!tx.success) throw new Error((tx as { error: string }).error);
      void fetchBalances();
      return (tx as { transactionId: string }).transactionId;
    } finally { setBusy(false); }
  }, [router, tokenContract, address, walletAddress, tokenAddr, network, provider, fetchBalances]);

  // ── Add Liquidity (token + MOTO → LP) ──

  const addLiquidity = useCallback(async (tokenAmount: bigint, motoAmount: bigint): Promise<string> => {
    if (!router || !tokenContract || !motoContract || !address || !walletAddress || !tokenAddr) throw new Error('Not connected');
    setBusy(true);
    try {
      // Approve tokens sequentially — wallet can only handle one popup at a time
      const appToken = await ensureAllowance(tokenContract, address, MOTOSWAP_ROUTER, tokenAmount, walletAddress, network, provider);
      if (appToken && !appToken.success) throw new Error((appToken as { error: string }).error);

      const appMoto = await ensureAllowance(motoContract, address, MOTOSWAP_ROUTER, motoAmount, walletAddress, network, provider);
      if (appMoto && !appMoto.success) throw new Error((appMoto as { error: string }).error);

      const deadline = BigInt(Math.floor(Date.now() / 1000) + 3600);
      const sim: CallResult = await router.addLiquidity(
        Address.fromString(tokenAddr),
        Address.fromString(MOTO_TOKEN),
        tokenAmount,
        motoAmount,
        0n, 0n,
        address,
        deadline,
      );
      const tx = await broadcastCall(sim, walletAddress, network, provider);
      if (!tx.success) throw new Error((tx as { error: string }).error);
      void fetchBalances();
      return (tx as { transactionId: string }).transactionId;
    } finally { setBusy(false); }
  }, [router, tokenContract, motoContract, address, walletAddress, tokenAddr, network, provider, fetchBalances]);

  return {
    motoBalance,
    tokenBalance,
    buyQuote,
    sellQuote,
    loading,
    busy,
    connected,
    reserves,
    getBuyQuote,
    getSellQuote,
    getMatchingAmount,
    buy,
    sell,
    addLiquidity,
    refresh: fetchBalances,
  };
}
