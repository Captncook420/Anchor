import { useState, useEffect, useCallback } from 'react';
import { Address } from '@btc-vision/transaction';
import type { StakingPosition } from '../types';
import { useWallet } from './useWallet';
import { getAnchorStaker, getAnchorToken } from '../services/ContractService';
import { getContractAddress } from '../config/contracts';
import { bigintToNumber } from '../utils/bigint';

const POLL_INTERVAL = 30_000;

// Contract constants (must match AnchorStaker.ts)
const BPS = 10_000n;
const DEV_BPS = 1_000n;
const BOOST_BPS = 15_000n;

const EMPTY_POSITION: StakingPosition = {
  stakedLp: 0,
  pendingBaseRewards: 0,
  pendingSellPressureRewards: 0,
  timeMultiplier: 0,
  multiplierStartBlock: 0,
  lastClaimBlock: 0,
  cooldownRemaining: 0,
  currentBlock: 0,
};

export function useStakingPosition(): {
  position: StakingPosition;
  loading: boolean;
  refresh: () => void;
} {
  const { provider, network, address, connected } = useWallet();
  const [position, setPosition] = useState<StakingPosition>(EMPTY_POSITION);
  const [loading, setLoading] = useState(true);

  const fetchPosition = useCallback(async () => {
    if (!connected || !address) {
      setPosition(EMPTY_POSITION);
      setLoading(false);
      return;
    }

    try {
      const staker = getAnchorStaker(provider, network, address);
      const anchorToken = getAnchorToken(provider, network, address);
      const lpPairAddr = getContractAddress('lpToken', network);

      const [posResult, rewardResult, blockNum, poolResult, globalPendingResult] = await Promise.all([
        staker.positionInfo(address),
        staker.pendingReward(address),
        provider.getBlockNumber(),
        staker.poolInfo(),
        anchorToken.pendingRewards(Address.fromString(lpPairAddr)),
      ]);

      if (posResult.revert || rewardResult.revert) return;

      const pos = posResult.properties as {
        staked: bigint;
        multiplierBps: bigint;
        multiplierStart: bigint;
        lastClaimBlock: bigint;
        cooldownRemaining: bigint;
      };

      const reward = rewardResult.properties as {
        rawPending: bigint;
        multiplierBps: bigint;
        afterMultiplier: bigint;
        afterFeeAndBoost: bigint;
      };

      // Estimate sell-pressure bonus: user's share of unconsumed global SP
      let spRewards = 0;
      if (!poolResult.revert && !globalPendingResult.revert) {
        const pool = poolResult.properties as { totalStaked: bigint };
        const globalPending = (globalPendingResult.properties as { amount: bigint }).amount;

        if (pool.totalStaked > 0n && globalPending > 0n && pos.staked > 0n) {
          const rawSpShare = (globalPending * pos.staked) / pool.totalStaked;
          const mulBps = reward.multiplierBps;
          const afterMul = (rawSpShare * mulBps) / BPS;
          const spDevFee = (afterMul * DEV_BPS) / BPS;
          const afterDev = afterMul - spDevFee;
          const boosted = (afterDev * BOOST_BPS) / BPS;
          spRewards = bigintToNumber(boosted);
        }
      }

      setPosition({
        stakedLp: bigintToNumber(pos.staked),
        pendingBaseRewards: bigintToNumber(reward.rawPending),
        pendingSellPressureRewards: spRewards,
        timeMultiplier: Number(pos.multiplierBps) / 100,
        multiplierStartBlock: Number(pos.multiplierStart),
        lastClaimBlock: Number(pos.lastClaimBlock),
        cooldownRemaining: Number(pos.cooldownRemaining),
        currentBlock: Number(blockNum),
      });
    } catch {
      // Keep stale data on error
    } finally {
      setLoading(false);
    }
  }, [provider, network, address, connected]);

  useEffect(() => {
    void fetchPosition();
    const interval = setInterval(() => void fetchPosition(), POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [fetchPosition]);

  return { position, loading, refresh: () => void fetchPosition() };
}
