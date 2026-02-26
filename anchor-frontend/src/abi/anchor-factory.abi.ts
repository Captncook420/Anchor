import { ABIDataTypes, BitcoinAbiTypes, OP_NET_ABI } from 'opnet';

export const ANCHOR_FACTORY_ABI = [
  {
    name: 'deployChildToken',
    inputs: [
      { name: 'name', type: ABIDataTypes.STRING },
      { name: 'symbol', type: ABIDataTypes.STRING },
    ],
    outputs: [{ name: 'tokenAddress', type: ABIDataTypes.ADDRESS }],
    type: BitcoinAbiTypes.Function,
  },
  {
    name: 'finalizeChild',
    inputs: [
      { name: 'childToken', type: ABIDataTypes.ADDRESS },
      { name: 'lpPair', type: ABIDataTypes.ADDRESS },
    ],
    outputs: [{ name: 'stakerAddress', type: ABIDataTypes.ADDRESS }],
    type: BitcoinAbiTypes.Function,
  },
  {
    name: 'setAnchorAddresses',
    inputs: [
      { name: 'token', type: ABIDataTypes.ADDRESS },
      { name: 'staker', type: ABIDataTypes.ADDRESS },
      { name: 'lpPool', type: ABIDataTypes.ADDRESS },
    ],
    outputs: [{ name: 'success', type: ABIDataTypes.BOOL }],
    type: BitcoinAbiTypes.Function,
  },
  {
    name: 'getChildToken',
    constant: true,
    inputs: [{ name: 'index', type: ABIDataTypes.UINT256 }],
    outputs: [{ name: 'token', type: ABIDataTypes.ADDRESS }],
    type: BitcoinAbiTypes.Function,
  },
  {
    name: 'getStakerFor',
    constant: true,
    inputs: [{ name: 'childToken', type: ABIDataTypes.ADDRESS }],
    outputs: [{ name: 'staker', type: ABIDataTypes.ADDRESS }],
    type: BitcoinAbiTypes.Function,
  },
  {
    name: 'getCreator',
    constant: true,
    inputs: [{ name: 'childToken', type: ABIDataTypes.ADDRESS }],
    outputs: [{ name: 'creator', type: ABIDataTypes.ADDRESS }],
    type: BitcoinAbiTypes.Function,
  },
  {
    name: 'getChildTokenCount',
    constant: true,
    inputs: [],
    outputs: [{ name: 'count', type: ABIDataTypes.UINT256 }],
    type: BitcoinAbiTypes.Function,
  },
  {
    name: 'getAnchorToken',
    constant: true,
    inputs: [],
    outputs: [{ name: 'token', type: ABIDataTypes.ADDRESS }],
    type: BitcoinAbiTypes.Function,
  },
  {
    name: 'getAnchorStaker',
    constant: true,
    inputs: [],
    outputs: [{ name: 'staker', type: ABIDataTypes.ADDRESS }],
    type: BitcoinAbiTypes.Function,
  },
  {
    name: 'isRegisteredToken',
    constant: true,
    inputs: [{ name: 'token', type: ABIDataTypes.ADDRESS }],
    outputs: [{ name: 'registered', type: ABIDataTypes.BOOL }],
    type: BitcoinAbiTypes.Function,
  },
  {
    name: 'isPendingToken',
    constant: true,
    inputs: [{ name: 'token', type: ABIDataTypes.ADDRESS }],
    outputs: [{ name: 'isPending', type: ABIDataTypes.BOOL }],
    type: BitcoinAbiTypes.Function,
  },
  ...OP_NET_ABI,
];
