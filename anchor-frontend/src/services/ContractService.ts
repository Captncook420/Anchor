import { getContract, OP_20_ABI } from 'opnet';
import type { AbstractRpcProvider, BitcoinInterfaceAbi } from 'opnet';
import type { Address } from '@btc-vision/transaction';
import type { Network } from '@btc-vision/bitcoin';
import { getContractAddress } from '../config/contracts';
import { ANCHOR_STAKER_ABI } from '../abi/anchor-staker.abi';
import { ANCHOR_FACTORY_ABI } from '../abi/anchor-factory.abi';
import { SELL_PRESSURE_ABI } from '../abi/sell-pressure-token.abi';
import { CHILD_STAKER_ABI } from '../abi/child-staker.abi';

// Contract instances are dynamically typed via Proxy — methods come from ABI at runtime.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyContract = any;

const cache = new Map<string, AnyContract>();

function cacheKey(address: string, networkId: string): string {
  return `${networkId}:${address}`;
}

function getCached(
  address: string,
  abi: BitcoinInterfaceAbi,
  provider: AbstractRpcProvider,
  network: Network,
  sender?: Address,
): AnyContract {
  const key = cacheKey(address, network.bech32);
  const cached = cache.get(key);
  if (cached) {
    if (sender) cached.setSender(sender);
    return cached;
  }

  const instance = getContract(address, abi, provider, network, sender);
  cache.set(key, instance);
  return instance;
}

/** Merge ABIs (flat arrays) by concatenation. */
function mergeAbi(...abis: unknown[][]): BitcoinInterfaceAbi {
  return abis.flat() as BitcoinInterfaceAbi;
}

// --- Typed contract getters ---

export function getAnchorToken(
  provider: AbstractRpcProvider,
  network: Network,
  sender?: Address,
): AnyContract {
  const addr = getContractAddress('anchorToken', network);
  const abi = mergeAbi(OP_20_ABI, SELL_PRESSURE_ABI);
  return getCached(addr, abi, provider, network, sender);
}

export function getAnchorStaker(
  provider: AbstractRpcProvider,
  network: Network,
  sender?: Address,
): AnyContract {
  const addr = getContractAddress('anchorStaker', network);
  return getCached(addr, ANCHOR_STAKER_ABI as unknown as BitcoinInterfaceAbi, provider, network, sender);
}

export function getFactory(
  provider: AbstractRpcProvider,
  network: Network,
  sender?: Address,
): AnyContract {
  const addr = getContractAddress('anchorFactory', network);
  return getCached(addr, ANCHOR_FACTORY_ABI as unknown as BitcoinInterfaceAbi, provider, network, sender);
}

export function getLpToken(
  provider: AbstractRpcProvider,
  network: Network,
  sender?: Address,
): AnyContract {
  const addr = getContractAddress('lpToken', network);
  return getCached(addr, OP_20_ABI, provider, network, sender);
}

export function getChildToken(
  address: string,
  provider: AbstractRpcProvider,
  network: Network,
  sender?: Address,
): AnyContract {
  const abi = mergeAbi(OP_20_ABI, SELL_PRESSURE_ABI);
  return getCached(address, abi, provider, network, sender);
}

export function getChildStaker(
  address: string,
  provider: AbstractRpcProvider,
  network: Network,
  sender?: Address,
): AnyContract {
  return getCached(address, CHILD_STAKER_ABI as unknown as BitcoinInterfaceAbi, provider, network, sender);
}

/** Clear contract cache (call on network switch or disconnect). */
export function clearContractCache(): void {
  cache.clear();
}
