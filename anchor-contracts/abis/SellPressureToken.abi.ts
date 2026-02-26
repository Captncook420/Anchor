import { ABIDataTypes, BitcoinAbiTypes, OP_NET_ABI } from 'opnet';

export const SellPressureTokenEvents = [];

export const SellPressureTokenAbi = [
    {
        name: 'setPool',
        inputs: [
            { name: 'pool', type: ABIDataTypes.ADDRESS },
            { name: 'approved', type: ABIDataTypes.BOOL },
        ],
        outputs: [{ name: 'success', type: ABIDataTypes.BOOL }],
        type: BitcoinAbiTypes.Function,
    },
    {
        name: 'setMinter',
        inputs: [
            { name: 'minter', type: ABIDataTypes.ADDRESS },
            { name: 'authorized', type: ABIDataTypes.BOOL },
        ],
        outputs: [{ name: 'success', type: ABIDataTypes.BOOL }],
        type: BitcoinAbiTypes.Function,
    },
    {
        name: 'pendingRewards',
        constant: true,
        inputs: [{ name: 'pool', type: ABIDataTypes.ADDRESS }],
        outputs: [{ name: 'amount', type: ABIDataTypes.UINT256 }],
        type: BitcoinAbiTypes.Function,
    },
    {
        name: 'consumePendingRewards',
        inputs: [{ name: 'pool', type: ABIDataTypes.ADDRESS }],
        outputs: [{ name: 'amount', type: ABIDataTypes.UINT256 }],
        type: BitcoinAbiTypes.Function,
    },
    {
        name: 'mint',
        inputs: [
            { name: 'to', type: ABIDataTypes.ADDRESS },
            { name: 'amount', type: ABIDataTypes.UINT256 },
        ],
        outputs: [{ name: 'success', type: ABIDataTypes.BOOL }],
        type: BitcoinAbiTypes.Function,
    },
    {
        name: 'injectSellPressure',
        inputs: [
            { name: 'pool', type: ABIDataTypes.ADDRESS },
            { name: 'amount', type: ABIDataTypes.UINT256 },
        ],
        outputs: [{ name: 'success', type: ABIDataTypes.BOOL }],
        type: BitcoinAbiTypes.Function,
    },
    {
        name: 'isPool',
        constant: true,
        inputs: [{ name: 'pool', type: ABIDataTypes.ADDRESS }],
        outputs: [{ name: 'approved', type: ABIDataTypes.BOOL }],
        type: BitcoinAbiTypes.Function,
    },
    {
        name: 'flowInfo',
        constant: true,
        inputs: [{ name: 'pool', type: ABIDataTypes.ADDRESS }],
        outputs: [
            { name: 'inFlow', type: ABIDataTypes.UINT256 },
            { name: 'outFlow', type: ABIDataTypes.UINT256 },
            { name: 'hwm', type: ABIDataTypes.UINT256 },
            { name: 'consumed', type: ABIDataTypes.UINT256 },
        ],
        type: BitcoinAbiTypes.Function,
    },
    ...SellPressureTokenEvents,
    ...OP_NET_ABI,
];

export default SellPressureTokenAbi;
