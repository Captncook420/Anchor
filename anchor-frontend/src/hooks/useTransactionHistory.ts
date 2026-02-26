import { useCallback, useEffect, useMemo, useRef } from 'react';
import type { Activity } from '../types';
import { useLocalStorage } from './useLocalStorage';
import { useWallet } from './useWallet';

const POLL_INTERVAL = 15_000; // 15s

function storageKey(walletAddress: string): string {
  return `anchor_txs_${walletAddress}`;
}

export function useTransactionHistory(): {
  transactions: Activity[];
  addTransaction: (tx: Omit<Activity, 'id'>) => void;
  clearHistory: () => void;
} {
  const { walletAddress, provider } = useWallet();
  const key = walletAddress ? storageKey(walletAddress) : 'anchor_txs_disconnected';

  const [stored, setStored] = useLocalStorage<Activity[]>(key, []);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const addTransaction = useCallback(
    (tx: Omit<Activity, 'id'>) => {
      const newTx: Activity = {
        ...tx,
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      };
      setStored([newTx, ...stored]);
    },
    [stored, setStored],
  );

  const clearHistory = useCallback(() => {
    setStored([]);
  }, [setStored]);

  // Poll pending TXs and mark as confirmed when they appear on-chain
  useEffect(() => {
    const hasPending = stored.some((tx) => tx.status === 'pending');
    if (!hasPending || !provider) {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
      return;
    }

    async function checkPending() {
      let changed = false;
      const updated = await Promise.all(
        stored.map(async (tx) => {
          if (tx.status !== 'pending') return tx;
          try {
            const result = await provider.getTransaction(tx.txHash);
            if (result) {
              changed = true;
              return { ...tx, status: 'confirmed' as const };
            }
          } catch {
            // Not confirmed yet
          }
          return tx;
        }),
      );
      if (changed) setStored(updated);
    }

    // Check immediately on mount
    void checkPending();

    // Then poll
    pollRef.current = setInterval(() => void checkPending(), POLL_INTERVAL);
    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [stored, provider, setStored]);

  const transactions = useMemo(() => stored, [stored]);

  return { transactions, addTransaction, clearHistory };
}
