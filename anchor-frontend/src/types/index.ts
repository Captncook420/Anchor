export interface StakingPosition {
  stakedLp: number;
  pendingBaseRewards: number;
  pendingSellPressureRewards: number;
  timeMultiplier: number;
  multiplierStartBlock: number;
  lastClaimBlock: number;
  cooldownRemaining: number;
  currentBlock: number;
}

export interface ProtocolStats {
  tvl: number;
  anchorPrice: number;
  totalStaked: number;
  apy: number;
  totalHolders: number;
  totalBurned: number;
}

export interface ChildToken {
  address: string;
  stakerAddress: string;
  name: string;
  symbol: string;
  price: number;
  change24h: number;
  tvl: number;
  stakerCount: number;
  apy: number;
  totalSupply: number;
  sellPressureAccumulated: number;
  creatorAddress: string;
  createdAtBlock: number;
  pendingPlatformFee: bigint;
}

export type ActivityType =
  | 'stake' | 'unstake' | 'claim' | 'compound'
  | 'buy' | 'sell' | 'lp'
  | 'create' | 'harvest' | 'approve';

export interface Activity {
  id: string;
  type: ActivityType;
  amount: number;
  tokenSymbol?: string;
  tokenAddress?: string;
  motoAmount?: number;
  timestamp: number;
  status: 'confirmed' | 'pending' | 'failed';
  txHash: string;
  wallet?: string;
}

/** @deprecated Use Activity instead */
export type Transaction = Activity;

export interface RewardsBreakdown {
  baseEmission: number;
  sellPressureBonus: number;
  devFee: number;
  boostMultiplier: number;
  timeMultiplier: number;
  totalClaimable: number;
  totalClaimableRaw: bigint;
}

export type TabId = 'stake' | 'unstake' | 'claim' | 'compound' | 'buy' | 'sell' | 'lp';

export interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'info' | 'warning';
  title: string;
  message: string;
  duration?: number;
}
