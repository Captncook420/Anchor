import { ABIDataTypes, BitcoinAbiTypes, OP_NET_ABI } from 'opnet';

// Merged: LpStaker base + AnchorStaker extension (matches auto-generated ABIs)
export const ANCHOR_STAKER_ABI = [
  // LpStaker base methods
  {
    name: 'stake',
    inputs: [{ name: 'amount', type: ABIDataTypes.UINT256 }],
    outputs: [{ name: 'success', type: ABIDataTypes.BOOL }],
    type: BitcoinAbiTypes.Function,
  },
  {
    name: 'unstake',
    inputs: [{ name: 'amount', type: ABIDataTypes.UINT256 }],
    outputs: [{ name: 'success', type: ABIDataTypes.BOOL }],
    type: BitcoinAbiTypes.Function,
  },
  {
    name: 'claim',
    inputs: [],
    outputs: [{ name: 'amount', type: ABIDataTypes.UINT256 }],
    type: BitcoinAbiTypes.Function,
  },
  {
    name: 'compound',
    inputs: [{ name: 'amount', type: ABIDataTypes.UINT256 }],
    outputs: [{ name: 'distributed', type: ABIDataTypes.UINT256 }],
    type: BitcoinAbiTypes.Function,
  },
  {
    name: 'pendingReward',
    constant: true,
    inputs: [{ name: 'user', type: ABIDataTypes.ADDRESS }],
    outputs: [
      { name: 'rawPending', type: ABIDataTypes.UINT256 },
      { name: 'multiplierBps', type: ABIDataTypes.UINT256 },
      { name: 'afterMultiplier', type: ABIDataTypes.UINT256 },
      { name: 'afterFeeAndBoost', type: ABIDataTypes.UINT256 },
    ],
    type: BitcoinAbiTypes.Function,
  },
  {
    name: 'positionInfo',
    constant: true,
    inputs: [{ name: 'user', type: ABIDataTypes.ADDRESS }],
    outputs: [
      { name: 'staked', type: ABIDataTypes.UINT256 },
      { name: 'multiplierBps', type: ABIDataTypes.UINT256 },
      { name: 'multiplierStart', type: ABIDataTypes.UINT256 },
      { name: 'lastClaimBlock', type: ABIDataTypes.UINT256 },
      { name: 'cooldownRemaining', type: ABIDataTypes.UINT256 },
    ],
    type: BitcoinAbiTypes.Function,
  },
  {
    name: 'poolInfo',
    constant: true,
    inputs: [],
    outputs: [
      { name: 'totalStaked', type: ABIDataTypes.UINT256 },
      { name: 'accRewardPerShare', type: ABIDataTypes.UINT256 },
      { name: 'lastRewardBlock', type: ABIDataTypes.UINT256 },
      { name: 'rewardPerBlock', type: ABIDataTypes.UINT256 },
    ],
    type: BitcoinAbiTypes.Function,
  },
  {
    name: 'emergencyUnstake',
    inputs: [{ name: 'amount', type: ABIDataTypes.UINT256 }],
    outputs: [{ name: 'success', type: ABIDataTypes.BOOL }],
    type: BitcoinAbiTypes.Function,
  },
  {
    name: 'setDevAddress',
    inputs: [{ name: 'newDev', type: ABIDataTypes.ADDRESS }],
    outputs: [{ name: 'success', type: ABIDataTypes.BOOL }],
    type: BitcoinAbiTypes.Function,
  },
  // AnchorStaker extension methods
  {
    name: 'setSellPressurePool',
    inputs: [{ name: 'pool', type: ABIDataTypes.ADDRESS }],
    outputs: [{ name: 'success', type: ABIDataTypes.BOOL }],
    type: BitcoinAbiTypes.Function,
  },
  {
    name: 'sellPressureInfo',
    constant: true,
    inputs: [],
    outputs: [
      { name: 'pool', type: ABIDataTypes.ADDRESS },
      { name: 'accSpPerShare', type: ABIDataTypes.UINT256 },
    ],
    type: BitcoinAbiTypes.Function,
  },
  ...OP_NET_ABI,
];
