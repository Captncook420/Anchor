import type { Network } from '@btc-vision/bitcoin';
import deployed from './deployed-addresses.json';

export interface ContractAddresses {
  readonly anchorToken: string;
  readonly anchorStaker: string;
  readonly anchorFactory: string;
  readonly lpToken: string;
}

// Single set of deployed addresses (testnet only for now)
const DEPLOYED: ContractAddresses = {
  anchorToken: deployed.anchorToken,
  anchorStaker: deployed.anchorStaker,
  anchorFactory: deployed.anchorFactory,
  lpToken: deployed.lpToken,
};

export function getContractAddresses(_network: Network): ContractAddresses {
  return DEPLOYED;
}

export function getContractAddress(
  contract: keyof ContractAddresses,
  network: Network,
): string {
  const addrs = getContractAddresses(network);
  const addr = addrs[contract];
  if (!addr) throw new Error(`No ${contract} address configured. Deploy contracts first.`);
  return addr;
}
