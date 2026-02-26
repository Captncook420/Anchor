import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { getContract, OP_20_ABI, MotoSwapFactoryAbi } from 'opnet';
import type { AbstractRpcProvider, BitcoinInterfaceAbi, CallResult } from 'opnet';
import { Address } from '@btc-vision/transaction';
import type { Network } from '@btc-vision/bitcoin';
import { useWallet } from './useWallet';
import { getChildStaker } from '../services/ContractService';
import { broadcastCall, ensureAllowance } from '../services/TransactionService';
import { bigintToNumber } from '../utils/bigint';
import { MOTOSWAP_FACTORY, MOTO_TOKEN } from '../config/dex';

export type ApprovalState = 'approve' | 'waiting' | 'ready';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyContract = any;

const POLL_INTERVAL = 15_000;

export interface ChildStakingPosition {
  readonly lpBalance: number;
  readonly lpBalanceRaw: bigint;
  readonly stakedLp: number;
  readonly stakedLpRaw: bigint;
  readonly pendingReward: number;
  readonly pendingRewardRaw: bigint;
  readonly multiplierBps: number;
  readonly cooldownBlocks: number;
  readonly rewardPerBlock: number;
  readonly totalStaked: number;
}

const EMPTY: ChildStakingPosition = {
  lpBalance: 0,
  lpBalanceRaw: 0n,
  stakedLp: 0,
  stakedLpRaw: 0n,
  pendingReward: 0,
  pendingRewardRaw: 0n,
  multiplierBps: 0,
  cooldownBlocks: 0,
  rewardPerBlock: 0,
  totalStaked: 0,
};

/** Look up the MotoSwap LP pair for childToken/MOTO. */
async function getLpPairAddress(
  tokenAddr: string,
  provider: AbstractRpcProvider,
  network: Network,
  sender?: Address,
): Promise<string | null> {
  try {
    const factory: AnyContract = getContract(
      MOTOSWAP_FACTORY,
      MotoSwapFactoryAbi as unknown as BitcoinInterfaceAbi,
      provider,
      network,
      sender,
    );
    const result = await factory.getPool(
      Address.fromString(tokenAddr),
      Address.fromString(MOTO_TOKEN),
    );
    if (result.revert) return null;
    const pool = result.properties.pool;
    if (typeof pool === 'string') return pool;
    if (pool && typeof pool === 'object' && typeof pool.toHex === 'function') {
      return pool.toHex() as string;
    }
    return String(pool);
  } catch {
    return null;
  }
}

export function useChildStaking(tokenAddr: string, stakerAddr: string) {
  const { provider, network, address, walletAddress, connected } = useWallet();
  const [position, setPosition] = useState<ChildStakingPosition>(EMPTY);
  const [lpPairAddr, setLpPairAddr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionPending, setActionPending] = useState(false);
  const [approvalState, setApprovalState] = useState<ApprovalState>('approve');
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Resolve LP pair address once
  useEffect(() => {
    if (!tokenAddr) return;
    getLpPairAddress(tokenAddr, provider, network, address ?? undefined).then(setLpPairAddr);
  }, [tokenAddr, provider, network, address]);

  // LP token contract (for balance + approve)
  const lpContract: AnyContract | null = useMemo(() => {
    if (!lpPairAddr) return null;
    return getContract(lpPairAddr, OP_20_ABI, provider, network, address ?? undefined);
  }, [lpPairAddr, provider, network, address]);

  // Child staker contract
  const staker: AnyContract | null = useMemo(() => {
    if (!stakerAddr) return null;
    return getChildStaker(stakerAddr, provider, network, address ?? undefined);
  }, [stakerAddr, provider, network, address]);

  const fetchPosition = useCallback(async () => {
    if (!staker || !connected || !address) {
      setPosition(EMPTY);
      setLoading(false);
      return;
    }

    try {
      const queries: Promise<AnyContract>[] = [
        staker.poolInfo(),
        staker.positionInfo(address),
        staker.pendingReward(address),
      ];
      if (lpContract) {
        queries.push(lpContract.balanceOf(address));
      }

      const results = await Promise.all(queries);
      const poolRes = results[0];
      const posRes = results[1];
      const rewardRes = results[2];
      const balRes = results[3];

      const pool = poolRes.revert ? null : poolRes.properties;
      const pos = posRes.revert ? null : posRes.properties;
      const reward = rewardRes.revert ? null : rewardRes.properties;
      const bal = balRes && !balRes.revert ? balRes.properties : null;

      setPosition({
        lpBalance: bal ? bigintToNumber(bal.balance ?? bal.result ?? 0n) : 0,
        lpBalanceRaw: bal ? (bal.balance ?? bal.result ?? 0n) as bigint : 0n,
        stakedLp: pos ? bigintToNumber(pos.staked as bigint) : 0,
        stakedLpRaw: pos ? pos.staked as bigint : 0n,
        pendingReward: reward ? bigintToNumber((reward.afterFeeAndBoost ?? reward.rawPending ?? 0n) as bigint) : 0,
        pendingRewardRaw: reward ? (reward.afterFeeAndBoost ?? reward.rawPending ?? 0n) as bigint : 0n,
        multiplierBps: pos ? Number(pos.multiplierBps) : 0,
        cooldownBlocks: pos ? Number(pos.cooldownRemaining) : 0,
        rewardPerBlock: pool ? bigintToNumber(pool.rewardPerBlock as bigint) : 0,
        totalStaked: pool ? bigintToNumber(pool.totalStaked as bigint) : 0,
      });
    } catch (err) {
      console.error('[useChildStaking] fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [staker, lpContract, address, connected]);

  useEffect(() => {
    void fetchPosition();
    const interval = setInterval(() => void fetchPosition(), POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [fetchPosition]);

  // ── Approval flow (same pattern as ANCHOR StakeForm) ──

  const checkAllowance = useCallback(async (): Promise<bigint> => {
    if (!lpContract || !address || !stakerAddr) return 0n;
    try {
      const result = await lpContract.allowance(address, Address.fromString(stakerAddr));
      return (result.properties?.remaining ?? 0n) as bigint;
    } catch {
      return 0n;
    }
  }, [lpContract, address, stakerAddr]);

  // Check allowance on mount / when deps change
  useEffect(() => {
    if (!connected || !address) return;
    checkAllowance().then((val) => {
      if (val > 0n) setApprovalState('ready');
    });
  }, [connected, address, checkAllowance]);

  // Clean up polling on unmount
  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  const startPolling = useCallback(() => {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      const val = await checkAllowance();
      if (val > 0n) {
        if (pollRef.current) clearInterval(pollRef.current);
        pollRef.current = null;
        setApprovalState('ready');
      }
    }, 15_000);
  }, [checkAllowance]);

  /** Send LP approval TX (step 1). Does NOT stake — wait for confirmation first. */
  const approveLp = useCallback(async (): Promise<string> => {
    if (!lpContract || !address || !walletAddress) throw new Error('Not connected');
    setActionPending(true);
    try {
      const maxAllowance = BigInt('0x7fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff');
      const result = await ensureAllowance(lpContract, address, stakerAddr, maxAllowance, walletAddress, network, provider);
      if (result && !result.success) throw new Error((result as { error: string }).error);
      setApprovalState('waiting');
      startPolling();
      return (result as { transactionId: string }).transactionId;
    } finally {
      setActionPending(false);
    }
  }, [lpContract, address, walletAddress, stakerAddr, network, provider, startPolling]);

  /** Stake LP tokens (step 2 — only call after approval is confirmed). */
  const stake = useCallback(async (amount: bigint): Promise<string> => {
    if (!staker || !walletAddress) throw new Error('Not connected');
    setActionPending(true);
    try {
      const sim: CallResult = await staker.stake(amount);
      const tx = await broadcastCall(sim, walletAddress, network, provider);
      if (!tx.success) throw new Error((tx as { error: string }).error);
      void fetchPosition();
      return (tx as { transactionId: string }).transactionId;
    } finally {
      setActionPending(false);
    }
  }, [staker, walletAddress, network, provider, fetchPosition]);

  /** Unstake LP tokens. */
  const unstake = useCallback(async (amount: bigint): Promise<string> => {
    if (!staker || !walletAddress) throw new Error('Not connected');
    setActionPending(true);
    try {
      const sim: CallResult = await staker.unstake(amount);
      const tx = await broadcastCall(sim, walletAddress, network, provider);
      if (!tx.success) throw new Error((tx as { error: string }).error);
      void fetchPosition();
      return (tx as { transactionId: string }).transactionId;
    } finally {
      setActionPending(false);
    }
  }, [staker, walletAddress, network, provider, fetchPosition]);

  /** Claim pending rewards (resets multiplier). */
  const claim = useCallback(async (): Promise<string> => {
    if (!staker || !walletAddress) throw new Error('Not connected');
    setActionPending(true);
    try {
      const sim: CallResult = await staker.claim();
      const tx = await broadcastCall(sim, walletAddress, network, provider);
      if (!tx.success) throw new Error((tx as { error: string }).error);
      void fetchPosition();
      return (tx as { transactionId: string }).transactionId;
    } finally {
      setActionPending(false);
    }
  }, [staker, walletAddress, network, provider, fetchPosition]);

  /** Compound rewards — mints tokens to wallet without resetting multiplier. */
  const compound = useCallback(async (amount: bigint): Promise<string> => {
    if (!staker || !walletAddress) throw new Error('Not connected');
    setActionPending(true);
    try {
      const sim: CallResult = await staker.compound(amount);
      const tx = await broadcastCall(sim, walletAddress, network, provider);
      if (!tx.success) throw new Error((tx as { error: string }).error);
      void fetchPosition();
      return (tx as { transactionId: string }).transactionId;
    } finally {
      setActionPending(false);
    }
  }, [staker, walletAddress, network, provider, fetchPosition]);

  return {
    position,
    lpPairAddr,
    loading,
    actionPending,
    connected,
    approvalState,
    approveLp,
    stake,
    unstake,
    claim,
    compound,
    refresh: fetchPosition,
  };
}
