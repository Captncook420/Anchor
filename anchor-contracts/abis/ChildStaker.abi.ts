import { ABIDataTypes, BitcoinAbiTypes, OP_NET_ABI } from 'opnet';

export const ChildStakerEvents = [];

export const ChildStakerAbi = [
    {
        name: 'platformFeeInfo',
        constant: true,
        inputs: [],
        outputs: [
            { name: 'pendingFee', type: ABIDataTypes.UINT256 },
            { name: 'creator', type: ABIDataTypes.ADDRESS },
            { name: 'anchorToken', type: ABIDataTypes.ADDRESS },
        ],
        type: BitcoinAbiTypes.Function,
    },
    {
        name: 'setCreator',
        inputs: [{ name: 'newCreator', type: ABIDataTypes.ADDRESS }],
        outputs: [{ name: 'success', type: ABIDataTypes.BOOL }],
        type: BitcoinAbiTypes.Function,
    },
    {
        name: 'setSellPressurePool',
        inputs: [{ name: 'pool', type: ABIDataTypes.ADDRESS }],
        outputs: [{ name: 'success', type: ABIDataTypes.BOOL }],
        type: BitcoinAbiTypes.Function,
    },
    {
        name: 'harvestFees',
        inputs: [],
        outputs: [{ name: 'amount', type: ABIDataTypes.UINT256 }],
        type: BitcoinAbiTypes.Function,
    },
    ...ChildStakerEvents,
    ...OP_NET_ABI,
];

export default ChildStakerAbi;
