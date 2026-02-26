import { useState, useEffect, useCallback } from 'react';
import type { ChildToken } from '../types';
import { Address } from '@btc-vision/transaction';
import { useWallet } from './useWallet';
import { getFactory, getChildToken, getChildStaker } from '../services/ContractService';
import { bigintToNumber } from '../utils/bigint';

const POLL_INTERVAL = 60_000;
const ZERO_ADDR_HEX = '0x0000000000000000000000000000000000000000000000000000000000000000';

/** SDK ADDRESS outputs may be Address objects or hex strings — normalize both. */
function toAddrString(val: unknown): string {
  if (typeof val === 'string') return val;
  // Address object — use p2tr (bech32m) or toString fallback
  if (val && typeof val === 'object') {
    const a = val as Record<string, unknown>;
    if (typeof a.toHex === 'function') return a.toHex() as string;
    if (typeof a.p2tr === 'function') return String(a.p2tr());
  }
  return String(val);
}

/** Ensure we have an Address object for SDK calls that require it. */
function ensureAddress(val: unknown): Address {
  if (val && typeof val === 'object' && typeof (val as Address).equals === 'function') {
    return val as Address;
  }
  return Address.fromString(String(val));
}

export function useChildTokens(): {
  tokens: ChildToken[];
  loading: boolean;
  refresh: () => void;
} {
  const { provider, network } = useWallet();
  const [tokens, setTokens] = useState<ChildToken[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchTokens = useCallback(async () => {
    try {
      const factory = getFactory(provider, network);

      const countResult = await factory.getChildTokenCount();
      if (countResult.revert) return;

      const count = Number((countResult.properties as { count: bigint }).count);
      if (count === 0) {
        setTokens([]);
        setLoading(false);
        return;
      }

      const childTokens: ChildToken[] = [];

      for (let i = 0; i < count; i++) {
        try {
          const indexResult = await factory.getChildToken(BigInt(i));
          if (indexResult.revert) continue;

          const tokenRaw = (indexResult.properties as { token: unknown }).token;
          const tokenAddrStr = toAddrString(tokenRaw);

          // Skip zero addresses (from deploys that were never finalized)
          if (tokenAddrStr === ZERO_ADDR_HEX || tokenAddrStr === '') continue;

          // SDK expects Address objects for ADDRESS-type inputs
          const tokenAddrObj = ensureAddress(tokenRaw);

          const [stakerResult, creatorResult] = await Promise.all([
            factory.getStakerFor(tokenAddrObj),
            factory.getCreator(tokenAddrObj),
          ]);

          const stakerRaw = stakerResult.revert ? null : (stakerResult.properties as { staker: unknown }).staker;
          const creatorRaw = creatorResult.revert ? null : (creatorResult.properties as { creator: unknown }).creator;
          const stakerAddr = stakerRaw ? toAddrString(stakerRaw) : '';
          const creatorAddr = creatorRaw ? toAddrString(creatorRaw) : '';

          // Fetch token metadata
          const token = getChildToken(tokenAddrStr, provider, network);
          const [nameResult, symbolResult, supplyResult] = await Promise.all([
            token.name(),
            token.symbol(),
            token.totalSupply(),
          ]);

          // Fetch staker pool info + platform fee if available
          let totalStaked = 0;
          let rewardPerBlock = 0;
          let pendingPlatformFee = 0n;
          if (stakerAddr) {
            const staker = getChildStaker(stakerAddr, provider, network);
            const [poolResult, feeResult] = await Promise.all([
              staker.poolInfo(),
              staker.platformFeeInfo(),
            ]);
            if (!poolResult.revert) {
              const pool = poolResult.properties as { totalStaked: bigint; rewardPerBlock: bigint };
              totalStaked = bigintToNumber(pool.totalStaked);
              rewardPerBlock = bigintToNumber(pool.rewardPerBlock);
            }
            if (!feeResult.revert) {
              pendingPlatformFee = (feeResult.properties as { pendingFee: bigint }).pendingFee;
            }
          }

          const supply = supplyResult.revert ? 0 : bigintToNumber((supplyResult.properties as { totalSupply: bigint }).totalSupply);
          const apy = totalStaked > 0 ? (rewardPerBlock * 52_560 / totalStaked) * 100 : 0;

          childTokens.push({
            address: tokenAddrStr,
            stakerAddress: stakerAddr,
            name: nameResult.revert ? 'Unknown' : String((nameResult.properties as { name: string }).name),
            symbol: symbolResult.revert ? '???' : String((symbolResult.properties as { symbol: string }).symbol),
            price: 0,
            change24h: 0,
            tvl: 0,
            stakerCount: 0,
            apy,
            totalSupply: supply,
            sellPressureAccumulated: 0,
            creatorAddress: creatorAddr,
            createdAtBlock: 0,
            pendingPlatformFee,
          });
        } catch {
          continue;
        }
      }

      setTokens(childTokens);
    } catch {
      // Keep stale data on error
    } finally {
      setLoading(false);
    }
  }, [provider, network]);

  useEffect(() => {
    void fetchTokens();
    const interval = setInterval(() => void fetchTokens(), POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [fetchTokens]);

  return { tokens, loading, refresh: () => void fetchTokens() };
}
