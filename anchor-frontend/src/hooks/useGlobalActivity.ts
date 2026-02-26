import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { JSONRpcProvider, OPNetTransactionTypes } from 'opnet';
import type { InteractionTransaction } from 'opnet';
import { useWallet } from './useWallet';
import { useChildTokens } from './useChildTokens';
import { getContractAddresses } from '../config/contracts';
import { getNetworkConfig } from '../config/networks';
import { MOTOSWAP_ROUTER } from '../config/dex';
import type { Activity, ActivityType } from '../types';

const POLL_INTERVAL = 30_000;
const INITIAL_BLOCK_LOOKBACK = 50;
const MAX_ACTIVITIES = 100;
const BATCH_SIZE = 10;

/**
 * Scans recent blocks for transactions interacting with ANCHOR contracts.
 * Uses its OWN dedicated read-only provider so block-fetching traffic
 * never touches the shared provider's UTXO manager.
 */
export function useGlobalActivity(): {
  activities: Activity[];
  loading: boolean;
} {
  const { network } = useWallet();
  const { tokens } = useChildTokens();
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const lastBlockRef = useRef<bigint>(0n);
  const initialFetchDone = useRef(false);
  const scanningRef = useRef(false);

  // Dedicated read-only provider — isolated from the TX-sending provider
  const readProvider = useMemo(() => {
    try {
      const config = getNetworkConfig(network);
      return new JSONRpcProvider({ url: config.rpcUrl, network, timeout: 30_000 });
    } catch (err) {
      console.error('[useGlobalActivity] Failed to create provider:', err);
      return null;
    }
  }, [network]);

  // Stable ref for contract address map — avoids cascading callback recreation
  const contractMapRef = useRef(new Map<string, { label: string; type: ActivityType }>());
  useEffect(() => {
    const addrs = getContractAddresses(network);
    const map = new Map<string, { label: string; type: ActivityType }>();

    if (addrs.anchorFactory) map.set(addrs.anchorFactory.toLowerCase(), { label: 'Factory', type: 'create' });
    if (addrs.anchorStaker) map.set(addrs.anchorStaker.toLowerCase(), { label: 'ANCHOR Staker', type: 'stake' });
    if (addrs.anchorToken) map.set(addrs.anchorToken.toLowerCase(), { label: 'ANCHOR', type: 'buy' });
    if (MOTOSWAP_ROUTER) map.set(MOTOSWAP_ROUTER.toLowerCase(), { label: 'MotoSwap', type: 'buy' });

    for (const t of tokens) {
      if (t.address) map.set(t.address.toLowerCase(), { label: t.symbol, type: 'buy' });
      if (t.stakerAddress) map.set(t.stakerAddress.toLowerCase(), { label: `${t.symbol} Staker`, type: 'stake' });
    }

    contractMapRef.current = map;
  }, [network, tokens]);

  const processBlocks = useCallback(async (fromBlock: bigint, toBlock: bigint): Promise<Activity[]> => {
    if (!readProvider || fromBlock > toBlock) return [];

    const blockNumbers: bigint[] = [];
    for (let i = fromBlock; i <= toBlock; i++) {
      blockNumbers.push(i);
    }
    if (blockNumbers.length === 0) return [];

    const contractMap = contractMapRef.current;
    const newActivities: Activity[] = [];

    for (let i = 0; i < blockNumbers.length; i += BATCH_SIZE) {
      const batch = blockNumbers.slice(i, i + BATCH_SIZE);
      try {
        const blocks = await readProvider.getBlocks(batch, true);
        if (!blocks) continue;

        for (const block of blocks) {
          if (!block?.transactions) continue;
          const blockTime = block.time > 1e12 ? block.time : block.time * 1000;

          for (const tx of block.transactions) {
            if (tx.OPNetType !== OPNetTransactionTypes.Interaction) continue;

            const interactionTx = tx as InteractionTransaction;
            const contractAddr = interactionTx.contractAddress?.toLowerCase();
            if (!contractAddr) continue;

            const match = contractMap.get(contractAddr);
            if (!match) continue;

            let fromAddr = 'unknown';
            try {
              fromAddr = interactionTx.from?.toHex?.() ?? interactionTx.from?.toString() ?? 'unknown';
            } catch { /* address parsing failed */ }

            newActivities.push({
              id: `${tx.hash}-${tx.index}`,
              type: match.type,
              amount: 0,
              tokenSymbol: match.label,
              timestamp: blockTime,
              status: 'confirmed',
              txHash: tx.hash,
              wallet: fromAddr,
            });
          }
        }
      } catch (err) {
        console.error('[useGlobalActivity] Error fetching blocks:', err);
      }
    }

    return newActivities;
  }, [readProvider]);

  const scan = useCallback(async () => {
    if (scanningRef.current || !readProvider) return;
    scanningRef.current = true;

    try {
      const currentBlock = await readProvider.getBlockNumber();

      if (!initialFetchDone.current) {
        const startBlock = currentBlock > BigInt(INITIAL_BLOCK_LOOKBACK)
          ? currentBlock - BigInt(INITIAL_BLOCK_LOOKBACK)
          : 1n;

        const newItems = await processBlocks(startBlock, currentBlock);
        const sorted = newItems.sort((a, b) => b.timestamp - a.timestamp).slice(0, MAX_ACTIVITIES);
        setActivities(sorted);
        lastBlockRef.current = currentBlock;
        initialFetchDone.current = true;
        setLoading(false);
        return;
      }

      if (currentBlock <= lastBlockRef.current) return;

      const newItems = await processBlocks(lastBlockRef.current + 1n, currentBlock);
      if (newItems.length > 0) {
        setActivities(prev => {
          const merged = [...newItems, ...prev];
          return merged.sort((a, b) => b.timestamp - a.timestamp).slice(0, MAX_ACTIVITIES);
        });
      }
      lastBlockRef.current = currentBlock;
    } catch (err) {
      console.error('[useGlobalActivity] Scan error:', err);
      setLoading(false);
    } finally {
      scanningRef.current = false;
    }
  }, [readProvider, processBlocks]);

  // Only re-runs when readProvider changes (network switch)
  useEffect(() => {
    initialFetchDone.current = false;
    lastBlockRef.current = 0n;
    scanningRef.current = false;
    setActivities([]);
    setLoading(true);

    void scan();
    const interval = setInterval(() => void scan(), POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [scan]);

  return { activities, loading };
}
