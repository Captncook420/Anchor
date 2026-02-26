import { useState, useEffect, useCallback } from 'react';
import type { ProtocolStats } from '../types';
import { useWallet } from './useWallet';
import { getAnchorStaker, getAnchorToken } from '../services/ContractService';
import { bigintToNumber } from '../utils/bigint';

const POLL_INTERVAL = 60_000;

const EMPTY_STATS: ProtocolStats = {
  tvl: 0,
  anchorPrice: 0,
  totalStaked: 0,
  apy: 0,
  totalHolders: 0,
  totalBurned: 0,
};

export function useProtocolStats(): { stats: ProtocolStats; loading: boolean } {
  const { provider, network } = useWallet();
  const [stats, setStats] = useState<ProtocolStats>(EMPTY_STATS);
  const [loading, setLoading] = useState(true);

  const fetchStats = useCallback(async () => {
    try {
      const staker = getAnchorStaker(provider, network);
      const token = getAnchorToken(provider, network);

      const [poolResult, supplyResult] = await Promise.all([
        staker.poolInfo(),
        token.totalSupply(),
      ]);

      if (poolResult.revert || supplyResult.revert) return;

      const pool = poolResult.properties as {
        totalStaked: bigint;
        accRewardPerShare: bigint;
        lastRewardBlock: bigint;
        rewardPerBlock: bigint;
      };

      const supply = supplyResult.properties as { totalSupply: bigint };

      const totalStaked = bigintToNumber(pool.totalStaked);
      const rewardPerBlock = bigintToNumber(pool.rewardPerBlock);
      const totalSupply = bigintToNumber(supply.totalSupply);

      // APY estimate: (rewardPerBlock * blocks_per_year) / totalStaked * 100
      // ~144 blocks/day on Bitcoin → ~52,560/year
      const blocksPerYear = 52_560;
      const annualRewards = rewardPerBlock * blocksPerYear;
      const apy = totalStaked > 0 ? (annualRewards / totalStaked) * 100 : 0;

      setStats({
        tvl: 0, // Requires price oracle — placeholder
        anchorPrice: 0, // Requires MotoSwap pool — placeholder
        totalStaked,
        apy,
        totalHolders: 0, // Requires indexer — placeholder
        totalBurned: totalSupply > 0 ? 0 : 0, // Requires burn tracking — placeholder
      });
    } catch {
      // Keep stale data on error
    } finally {
      setLoading(false);
    }
  }, [provider, network]);

  useEffect(() => {
    void fetchStats();
    const interval = setInterval(() => void fetchStats(), POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [fetchStats]);

  return { stats, loading };
}
