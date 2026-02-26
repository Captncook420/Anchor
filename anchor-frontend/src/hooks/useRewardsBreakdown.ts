import { useState, useEffect, useCallback } from 'react';
import type { RewardsBreakdown } from '../types';
import { useWallet } from './useWallet';
import { getAnchorStaker } from '../services/ContractService';
import { bigintToNumber } from '../utils/bigint';

const POLL_INTERVAL = 30_000;

const EMPTY_REWARDS: RewardsBreakdown = {
  baseEmission: 0,
  sellPressureBonus: 0,
  devFee: 0,
  boostMultiplier: 1,
  timeMultiplier: 0,
  totalClaimable: 0,
  totalClaimableRaw: 0n,
};

export function useRewardsBreakdown(): {
  rewards: RewardsBreakdown;
  loading: boolean;
  refresh: () => void;
} {
  const { provider, network, address, connected } = useWallet();
  const [rewards, setRewards] = useState<RewardsBreakdown>(EMPTY_REWARDS);
  const [loading, setLoading] = useState(true);

  const fetchRewards = useCallback(async () => {
    if (!connected || !address) {
      setRewards(EMPTY_REWARDS);
      setLoading(false);
      return;
    }

    try {
      const staker = getAnchorStaker(provider, network, address);
      const result = await staker.pendingReward(address);

      if (result.revert) return;

      const r = result.properties as {
        rawPending: bigint;
        multiplierBps: bigint;
        afterMultiplier: bigint;
        afterFeeAndBoost: bigint;
      };

      const rawPending = bigintToNumber(r.rawPending);
      const afterMultiplier = bigintToNumber(r.afterMultiplier);
      const afterFeeAndBoost = bigintToNumber(r.afterFeeAndBoost);
      const multiplierBps = Number(r.multiplierBps);

      // Dev fee is the difference between afterMultiplier and afterFeeAndBoost
      const devFee = afterMultiplier - afterFeeAndBoost;

      setRewards({
        baseEmission: rawPending,
        sellPressureBonus: 0, // Separate sell-pressure tracking
        devFee: devFee > 0 ? devFee : 0,
        boostMultiplier: 1, // Base boost — extend later
        timeMultiplier: multiplierBps / 10_000,
        totalClaimable: afterFeeAndBoost,
        totalClaimableRaw: r.afterFeeAndBoost,
      });
    } catch {
      // Keep stale data on error
    } finally {
      setLoading(false);
    }
  }, [provider, network, address, connected]);

  useEffect(() => {
    void fetchRewards();
    const interval = setInterval(() => void fetchRewards(), POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [fetchRewards]);

  return { rewards, loading, refresh: () => void fetchRewards() };
}
