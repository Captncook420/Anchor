import { useState, useEffect, useCallback } from 'react';
import type { StakingPosition } from '../types';
import { useWallet } from './useWallet';
import { getAnchorStaker } from '../services/ContractService';
import { bigintToNumber } from '../utils/bigint';

const POLL_INTERVAL = 30_000;

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

      const [posResult, rewardResult, blockNum] = await Promise.all([
        staker.positionInfo(address),
        staker.pendingReward(address),
        provider.getBlockNumber(),
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

      setPosition({
        stakedLp: bigintToNumber(pos.staked),
        pendingBaseRewards: bigintToNumber(reward.rawPending),
        pendingSellPressureRewards: 0, // Sell-pressure rewards come from sellPressureInfo
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
