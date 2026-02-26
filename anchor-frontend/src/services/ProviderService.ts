import { JSONRpcProvider } from 'opnet';
import type { Network } from '@btc-vision/bitcoin';
import { getNetworkConfig, getNetworkId } from '../config/networks';

const providers = new Map<string, JSONRpcProvider>();

/** Get or create a JSONRpcProvider for the given network. Cached per network. */
export function getProvider(network: Network): JSONRpcProvider {
  const id = getNetworkId(network);
  const cached = providers.get(id);
  if (cached) return cached;

  const config = getNetworkConfig(network);
  const provider = new JSONRpcProvider({
    url: config.rpcUrl,
    network,
    timeout: 30_000,
  });

  providers.set(id, provider);
  return provider;
}

/** Clear cached providers (e.g. on network switch). */
export function clearProviders(): void {
  providers.clear();
}
