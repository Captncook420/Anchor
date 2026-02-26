import { ABIDataTypes, BitcoinAbiTypes, OP_NET_ABI } from 'opnet';

export const LpStakerEvents = [];

export const LpStakerAbi = [
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
    ...LpStakerEvents,
    ...OP_NET_ABI,
];

export default LpStakerAbi;
