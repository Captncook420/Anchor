import type { Network } from '@btc-vision/bitcoin';
import type { CallResult } from 'opnet';
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

const MAX_SAT_TO_SPEND = 500_000n; // 0.005 BTC safety cap

/**
 * Send a simulated contract call as a real transaction.
 * Frontend pattern: signer=null, mldsaSigner=null — wallet extension handles signing.
 */
export async function broadcastCall(
  callResult: CallResult,
  refundTo: string,
  network: Network,
): Promise<TxOutcome> {
  if ('error' in callResult) {
    return { success: false, error: `Simulation error: ${String((callResult as Record<string, unknown>).error)}` };
  }
  if (callResult.revert) {
    return { success: false, error: `Simulation reverted: ${callResult.revert}` };
  }

  try {
    const receipt = await callResult.sendTransaction({
      signer: null,
      mldsaSigner: null,
      refundTo,
      maximumAllowedSatToSpend: MAX_SAT_TO_SPEND,
      feeRate: 10,
      network,
    });

    return { success: true, transactionId: receipt.transactionId };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
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
): Promise<TxOutcome | null> {
  const spenderAddr = typeof spender === 'string' ? Address.fromString(spender) : spender;
  const increaseResult = await tokenContract.increaseAllowance(spenderAddr, amount);
  return broadcastCall(increaseResult, refundTo, network);
}
