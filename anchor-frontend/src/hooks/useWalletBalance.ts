import { useState, useEffect, useCallback } from 'react';
import { useWallet } from './useWallet';
import { getAnchorToken, getLpToken } from '../services/ContractService';
import { bigintToNumber } from '../utils/bigint';

const POLL_INTERVAL = 30_000;

export interface WalletBalances {
  readonly anchorBalance: number;
  readonly lpBalance: number;
}

const EMPTY_BALANCES: WalletBalances = { anchorBalance: 0, lpBalance: 0 };

export function useWalletBalance(): {
  balances: WalletBalances;
  loading: boolean;
  refresh: () => void;
} {
  const { provider, network, address, connected } = useWallet();
  const [balances, setBalances] = useState<WalletBalances>(EMPTY_BALANCES);
  const [loading, setLoading] = useState(true);

  const fetchBalances = useCallback(async () => {
    if (!connected || !address) {
      setBalances(EMPTY_BALANCES);
      setLoading(false);
      return;
    }

    try {
      const anchorToken = getAnchorToken(provider, network, address);
      const lpToken = getLpToken(provider, network, address);

      const [anchorResult, lpResult] = await Promise.all([
        anchorToken.balanceOf(address),
        lpToken.balanceOf(address),
      ]);

      setBalances({
        anchorBalance: anchorResult.revert ? 0 : bigintToNumber((anchorResult.properties as { balance: bigint }).balance),
        lpBalance: lpResult.revert ? 0 : bigintToNumber((lpResult.properties as { balance: bigint }).balance),
      });
    } catch {
      // Keep stale data on error
    } finally {
      setLoading(false);
    }
  }, [provider, network, address, connected]);

  useEffect(() => {
    void fetchBalances();
    const interval = setInterval(() => void fetchBalances(), POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [fetchBalances]);

  return { balances, loading, refresh: () => void fetchBalances() };
}
