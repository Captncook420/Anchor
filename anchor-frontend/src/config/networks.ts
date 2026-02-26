import { networks, type Network } from '@btc-vision/bitcoin';

export interface NetworkConfig {
  readonly name: string;
  readonly rpcUrl: string;
}

export const NETWORK_CONFIGS: ReadonlyMap<Network, NetworkConfig> = new Map([
  [networks.bitcoin, {
    name: 'Mainnet',
    rpcUrl: 'https://mainnet.opnet.org',
  }],
  [networks.opnetTestnet, {
    name: 'Testnet',
    rpcUrl: 'https://testnet.opnet.org',
  }],
]);

export const DEFAULT_NETWORK: Network = networks.opnetTestnet;

export function getNetworkConfig(network: Network): NetworkConfig {
  const config = NETWORK_CONFIGS.get(network);
  if (!config) throw new Error(`No config for network`);
  return config;
}

export function getNetworkId(network: Network): string {
  if (network === networks.bitcoin) return 'mainnet';
  if (network === networks.opnetTestnet) return 'testnet';
  if (network === networks.regtest) return 'regtest';
  return 'unknown';
}
