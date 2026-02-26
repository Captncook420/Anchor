import { ABIDataTypes, BitcoinAbiTypes, OP_NET_ABI } from 'opnet';

export const AnchorStakerEvents = [];

export const AnchorStakerAbi = [
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
    ...AnchorStakerEvents,
    ...OP_NET_ABI,
];

export default AnchorStakerAbi;
