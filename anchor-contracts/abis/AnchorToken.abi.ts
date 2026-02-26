import { ABIDataTypes, BitcoinAbiTypes, OP_NET_ABI } from 'opnet';

export const AnchorTokenEvents = [];

export const AnchorTokenAbi = [
    {
        name: 'authorizeChildStaker',
        inputs: [{ name: 'staker', type: ABIDataTypes.ADDRESS }],
        outputs: [{ name: 'success', type: ABIDataTypes.BOOL }],
        type: BitcoinAbiTypes.Function,
    },
    {
        name: 'getFactory',
        constant: true,
        inputs: [],
        outputs: [{ name: 'factory', type: ABIDataTypes.ADDRESS }],
        type: BitcoinAbiTypes.Function,
    },
    ...AnchorTokenEvents,
    ...OP_NET_ABI,
];

export default AnchorTokenAbi;
