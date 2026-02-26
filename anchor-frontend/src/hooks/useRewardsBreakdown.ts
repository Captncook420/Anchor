import { useState, useEffect, useCallback } from 'react';
import { Address } from '@btc-vision/transaction';
import type { RewardsBreakdown } from '../types';
import { useWallet } from './useWallet';
import { getAnchorStaker, getAnchorToken } from '../services/ContractService';
import { getContractAddress } from '../config/contracts';
import { bigintToNumber } from '../utils/bigint';

const POLL_INTERVAL = 30_000;

// Contract constants (must match AnchorStaker.ts)
const BPS = 10_000n;
const DEV_BPS = 1_000n;   // 10%
const BOOST_BPS = 15_000n; // 150%

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
      const anchorToken = getAnchorToken(provider, network, address);
      const lpPairAddr = getContractAddress('lpToken', network);

      const lpPairAddress = Address.fromString(lpPairAddr);
      const [rewardResult, poolResult, globalPendingResult] = await Promise.all([
        staker.pendingReward(address),
        staker.poolInfo(),
        anchorToken.pendingRewards(lpPairAddress),
      ]);

      if (rewardResult.revert) return;

      const r = rewardResult.properties as {
        rawPending: bigint;
        multiplierBps: bigint;
        afterMultiplier: bigint;
        afterFeeAndBoost: bigint;
      };

      const rawPending = bigintToNumber(r.rawPending);
      const afterMultiplier = bigintToNumber(r.afterMultiplier);
      const afterFeeAndBoost = bigintToNumber(r.afterFeeAndBoost);
      const multiplierBps = Number(r.multiplierBps);

      const devFee = afterMultiplier - afterFeeAndBoost;

      // Estimate sell-pressure bonus: user's proportional share of unconsumed global SP
      let spBonus = 0;
      if (!poolResult.revert && !globalPendingResult.revert) {
        const pool = poolResult.properties as { totalStaked: bigint };
        const globalPending = (globalPendingResult.properties as { amount: bigint }).amount;

        if (pool.totalStaked > 0n && globalPending > 0n) {
          // positionInfo gives user's staked amount
          const posResult = await staker.positionInfo(address);
          if (!posResult.revert) {
            const userStaked = (posResult.properties as { staked: bigint }).staked;
            if (userStaked > 0n) {
              // User's share of unconsumed global pending SP
              const rawSpShare = (globalPending * userStaked) / pool.totalStaked;

              // Apply same pipeline as contract: multiplier → devFee → boost
              const mulBps = BigInt(multiplierBps);
              const afterMul = (rawSpShare * mulBps) / BPS;
              const spDevFee = (afterMul * DEV_BPS) / BPS;
              const afterDev = afterMul - spDevFee;
              const boosted = (afterDev * BOOST_BPS) / BPS;

              spBonus = bigintToNumber(boosted);
            }
          }
        }
      }

      setRewards({
        baseEmission: rawPending,
        sellPressureBonus: spBonus,
        devFee: devFee > 0 ? devFee : 0,
        boostMultiplier: 1,
        timeMultiplier: multiplierBps / 10_000,
        totalClaimable: afterFeeAndBoost + spBonus,
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
