import { ABIDataTypes, BitcoinAbiTypes } from 'opnet';

// AnchorToken-specific methods (beyond SellPressureToken / OP20)
export const ANCHOR_TOKEN_ABI = [
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
];
