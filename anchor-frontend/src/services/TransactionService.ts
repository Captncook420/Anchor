import type { Network } from '@btc-vision/bitcoin';
import type { AbstractRpcProvider, CallResult } from 'opnet';
import { Address } from '@btc-vision/transaction';

export interface TxResult {
  readonly transactionId: string;
  readonly success: true;
}

export interface TxError {
  readonly success: false;
  readonly error: string;
}

export type TxOutcome = TxResult | TxError;

const MAX_SAT_TO_SPEND = 1_000_000n; // 0.01 BTC safety cap

/**
 * Send a simulated contract call as a real transaction.
 * Frontend pattern: signer=null, mldsaSigner=null — wallet extension handles signing.
 *
 * Cleans the provider's UTXO cache before sending to avoid stale data
 * causing "Could not decode transaction" errors on sequential TXs.
 */
export async function broadcastCall(
  callResult: CallResult,
  refundTo: string,
  network: Network,
  provider?: AbstractRpcProvider,
): Promise<TxOutcome> {
  if ('error' in callResult) {
    return { success: false, error: `Simulation error: ${String((callResult as Record<string, unknown>).error)}` };
  }
  if (callResult.revert) {
    return { success: false, error: `Simulation reverted: ${callResult.revert}` };
  }

  const sendOpts = {
    signer: null,
    mldsaSigner: null,
    refundTo,
    maximumAllowedSatToSpend: MAX_SAT_TO_SPEND,
    feeRate: 10,
    network,
  };

  try {
    if (provider) provider.utxoManager.clean();

    const receipt = await callResult.sendTransaction(sendOpts);
    return { success: true, transactionId: receipt.transactionId };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);

    // Retry once on UTXO staleness — clean cache, wait briefly, re-send
    if (provider && message.includes('Could not decode transaction')) {
      console.warn('[broadcastCall] UTXO stale, retrying after cache clean...');
      try {
        provider.utxoManager.clean();
        await new Promise((r) => setTimeout(r, 2000));
        provider.utxoManager.clean();

        const receipt = await callResult.sendTransaction(sendOpts);
        return { success: true, transactionId: receipt.transactionId };
      } catch (retryErr: unknown) {
        console.error('[broadcastCall] retry also failed:', retryErr);
        const retryMsg = retryErr instanceof Error ? retryErr.message : String(retryErr);
        return { success: false, error: retryMsg };
      }
    }

    console.error('[broadcastCall] sendTransaction failed:', err);
    return { success: false, error: message };
  }
}

/**
 * Grant allowance for a spender via increaseAllowance.
 * Skips the allowance query (some LP pair contracts don't implement it)
 * and always sends increaseAllowance with the full amount.
 */
export async function ensureAllowance(
  tokenContract: { increaseAllowance: (...args: unknown[]) => Promise<CallResult> },
  _owner: Address,
  spender: Address | string,
  amount: bigint,
  refundTo: string,
  network: Network,
  provider?: AbstractRpcProvider,
): Promise<TxOutcome | null> {
  const spenderAddr = typeof spender === 'string' ? Address.fromString(spender) : spender;
  const increaseResult = await tokenContract.increaseAllowance(spenderAddr, amount);
  return broadcastCall(increaseResult, refundTo, network, provider);
}
