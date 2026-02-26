import { useCallback, useEffect, useMemo } from 'react';
import { useWalletConnect, SupportedWallets } from '@btc-vision/walletconnect';
import type { AbstractRpcProvider } from 'opnet';
import { Address } from '@btc-vision/transaction';
import type { Network } from '@btc-vision/bitcoin';
import { clearContractCache } from '../services/ContractService';
import { getProvider } from '../services/ProviderService';
import { DEFAULT_NETWORK } from '../config/networks';

export interface WalletState {
  readonly connected: boolean;
  readonly connecting: boolean;
  readonly walletAddress: string | null;
  readonly address: Address | null;
  readonly network: Network;
  readonly provider: AbstractRpcProvider;
  readonly connect: () => void;
  readonly disconnect: () => void;
}

export function useWallet(): WalletState {
  const wc = useWalletConnect();

  const network: Network = (wc.network as Network | null) ?? DEFAULT_NETWORK;
  const connected = wc.walletAddress !== null;

  // Build a proper Address object with `equals` method.
  // wc.address can be a bech32m string at runtime despite the type, so we validate it.
  const address: Address | null = useMemo(() => {
    if (wc.address && typeof wc.address === 'object' && typeof (wc.address as Address).equals === 'function') {
      return wc.address as Address;
    }
    if (wc.mldsaPublicKey) {
      try { return Address.fromString(wc.mldsaPublicKey, wc.publicKey ?? undefined); } catch { /* fall through */ }
    }
    if (wc.hashedMLDSAKey) {
      try { return Address.fromString(wc.hashedMLDSAKey, wc.publicKey ?? undefined); } catch { /* fall through */ }
    }
    return null;
  }, [wc.address, wc.mldsaPublicKey, wc.hashedMLDSAKey, wc.publicKey]);

  // Use wallet provider when connected, fallback to standalone
  const provider: AbstractRpcProvider = useMemo(
    () => wc.provider ?? getProvider(network),
    [wc.provider, network],
  );

  // Clear contract cache when network changes
  useEffect(() => {
    clearContractCache();
  }, [network]);

  const connect = useCallback(() => {
    wc.connectToWallet(SupportedWallets.OP_WALLET);
  }, [wc]);

  const disconnect = useCallback(() => {
    wc.disconnect();
    clearContractCache();
  }, [wc]);

  return {
    connected,
    connecting: wc.connecting,
    walletAddress: wc.walletAddress,
    address,
    network,
    provider,
    connect,
    disconnect,
  };
}
