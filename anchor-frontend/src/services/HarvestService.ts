import type { AbstractRpcProvider, BitcoinInterfaceAbi, CallResult } from 'opnet';
import {
  getContract,
  OP_20_ABI,
  MOTOSWAP_ROUTER_ABI,
} from 'opnet';
import type { IMotoswapRouterContract } from 'opnet';
import { Address } from '@btc-vision/transaction';
import type { Network } from '@btc-vision/bitcoin';
import { CHILD_STAKER_ABI } from '../abi/child-staker.abi';
import { SELL_PRESSURE_ABI } from '../abi/sell-pressure-token.abi';
import { broadcastCall } from './TransactionService';
import { getContractAddresses } from '../config/contracts';
import { MOTO_TOKEN, MOTOSWAP_ROUTER } from '../config/dex';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyContract = any;

// Dead address for LP token burn (all zeros)
const DEAD_ADDRESS = '0x0000000000000000000000000000000000000000000000000000000000000000';

export type HarvestStatus = 'pending' | 'active' | 'done' | 'error';

export interface HarvestStep {
  readonly id: string;
  readonly label: string;
  status: HarvestStatus;
  txId?: string;
  error?: string;
}

export const HARVEST_STEPS: readonly { id: string; label: string }[] = [
  { id: 'harvest', label: 'Harvest platform fees' },
  { id: 'approve-router', label: 'Approve tokens for swap' },
  { id: 'swap-moto', label: 'Swap half to MOTO' },
  { id: 'swap-anchor', label: 'Swap half to ANCHOR' },
  { id: 'approve-lp', label: 'Approve for LP' },
  { id: 'add-lp', label: 'Add MOTO/ANCHOR liquidity' },
  { id: 'burn-lp', label: 'Burn LP tokens' },
];

function mergeAbi(
  ...abis: ReadonlyArray<ReadonlyArray<unknown>>
): BitcoinInterfaceAbi {
  return abis.flat() as BitcoinInterfaceAbi;
}

/**
 * Multi-tx harvest flow:
 * 1. harvestFees() on ChildStaker -> mints child tokens to caller + injects SP on-chain
 * 2. Approve child tokens for MotoSwap router
 * 3. Swap half child tokens -> MOTO
 * 4. Swap half child tokens -> ANCHOR
 * 5. Approve MOTO + ANCHOR for router
 * 6. addLiquidity(MOTO, ANCHOR)
 * 7. Transfer LP tokens to dead address (burn)
 */
export async function harvestAndBurn(
  childTokenAddr: string,
  childStakerAddr: string,
  provider: AbstractRpcProvider,
  network: Network,
  walletAddress: string,
  senderAddress: Address,
  onStep: (stepId: string, update: Partial<HarvestStep>) => void,
): Promise<void> {
  const addrs = getContractAddresses(network);
  const anchorTokenAddr = addrs.anchorToken;
  const deadline = BigInt(Math.floor(Date.now() / 1000) + 3600);

  // -- Step 1: Harvest fees --
  onStep('harvest', { status: 'active' });

  const stakerContract: AnyContract = getContract(
    childStakerAddr,
    CHILD_STAKER_ABI as BitcoinInterfaceAbi,
    provider,
    network,
    senderAddress,
  );

  const harvestResult: CallResult = await stakerContract.harvestFees();
  const harvestTx = await broadcastCall(harvestResult, walletAddress, network, provider);
  if (!harvestTx.success) throw new Error(`Harvest failed: ${harvestTx.error}`);

  const harvestedAmount = (harvestResult.properties as { amount: bigint }).amount;
  if (harvestedAmount === 0n) {
    onStep('harvest', { status: 'done' });
    throw new Error('No fees to harvest');
  }

  onStep('harvest', { status: 'done', txId: harvestTx.success ? harvestTx.transactionId : undefined });

  const halfAmount = harvestedAmount / 2n;
  const otherHalf = harvestedAmount - halfAmount;

  // -- Step 2: Approve child tokens for router --
  onStep('approve-router', { status: 'active' });

  const childToken: AnyContract = getContract(
    childTokenAddr,
    mergeAbi(OP_20_ABI, SELL_PRESSURE_ABI),
    provider,
    network,
    senderAddress,
  );

  const approveResult: CallResult = await childToken.increaseAllowance(
    Address.fromString(MOTOSWAP_ROUTER),
    harvestedAmount,
  );
  const approveTx = await broadcastCall(approveResult, walletAddress, network, provider);
  if (!approveTx.success) throw new Error(`Approve failed: ${approveTx.error}`);

  onStep('approve-router', { status: 'done' });

  // -- Step 3: Swap half -> MOTO --
  onStep('swap-moto', { status: 'active' });

  const router = getContract<IMotoswapRouterContract>(
    MOTOSWAP_ROUTER,
    MOTOSWAP_ROUTER_ABI,
    provider,
    network,
    senderAddress,
  );

  const swapMotoResult = await router.swapExactTokensForTokensSupportingFeeOnTransferTokens(
    halfAmount,
    0n,
    [Address.fromString(childTokenAddr), Address.fromString(MOTO_TOKEN)],
    senderAddress,
    deadline,
  );
  const swapMotoTx = await broadcastCall(swapMotoResult, walletAddress, network, provider);
  if (!swapMotoTx.success) throw new Error(`Swap to MOTO failed: ${swapMotoTx.error}`);

  onStep('swap-moto', { status: 'done' });

  // -- Step 4: Swap half -> ANCHOR --
  onStep('swap-anchor', { status: 'active' });

  const swapAnchorResult = await router.swapExactTokensForTokensSupportingFeeOnTransferTokens(
    otherHalf,
    0n,
    [Address.fromString(childTokenAddr), Address.fromString(anchorTokenAddr)],
    senderAddress,
    deadline,
  );
  const swapAnchorTx = await broadcastCall(swapAnchorResult, walletAddress, network, provider);
  if (!swapAnchorTx.success) throw new Error(`Swap to ANCHOR failed: ${swapAnchorTx.error}`);

  onStep('swap-anchor', { status: 'done' });

  // -- Step 5: Approve MOTO + ANCHOR for router --
  onStep('approve-lp', { status: 'active' });

  const motoToken: AnyContract = getContract(MOTO_TOKEN, OP_20_ABI, provider, network, senderAddress);
  const anchorToken: AnyContract = getContract(
    anchorTokenAddr,
    mergeAbi(OP_20_ABI, SELL_PRESSURE_ABI),
    provider,
    network,
    senderAddress,
  );

  const motoBalResult: CallResult = await motoToken.balanceOf(senderAddress);
  const anchorBalResult: CallResult = await anchorToken.balanceOf(senderAddress);

  const motoBal = motoBalResult.revert ? 0n : (motoBalResult.properties as { balance: bigint }).balance;
  const anchorBal = anchorBalResult.revert ? 0n : (anchorBalResult.properties as { balance: bigint }).balance;

  if (motoBal === 0n || anchorBal === 0n) {
    throw new Error('Swap produced zero tokens - cannot add liquidity');
  }

  const approveMoto: CallResult = await motoToken.increaseAllowance(
    Address.fromString(MOTOSWAP_ROUTER),
    motoBal,
  );
  await broadcastCall(approveMoto, walletAddress, network, provider);

  const approveAnchor: CallResult = await anchorToken.increaseAllowance(
    Address.fromString(MOTOSWAP_ROUTER),
    anchorBal,
  );
  await broadcastCall(approveAnchor, walletAddress, network, provider);

  onStep('approve-lp', { status: 'done' });

  // -- Step 6: Add liquidity --
  onStep('add-lp', { status: 'active' });

  const addLiqResult = await router.addLiquidity(
    Address.fromString(MOTO_TOKEN),
    Address.fromString(anchorTokenAddr),
    motoBal,
    anchorBal,
    0n,
    0n,
    senderAddress,
    deadline,
  );
  const addLiqTx = await broadcastCall(addLiqResult, walletAddress, network, provider);
  if (!addLiqTx.success) throw new Error(`Add liquidity failed: ${addLiqTx.error}`);

  onStep('add-lp', { status: 'done' });

  // -- Step 7: Burn LP tokens --
  onStep('burn-lp', { status: 'active' });

  const lpTokenAddr = addrs.lpToken;
  const lpToken: AnyContract = getContract(lpTokenAddr, OP_20_ABI, provider, network, senderAddress);

  const lpBalResult: CallResult = await lpToken.balanceOf(senderAddress);
  const lpBal = lpBalResult.revert ? 0n : (lpBalResult.properties as { balance: bigint }).balance;

  if (lpBal > 0n) {
    const burnResult: CallResult = await lpToken.transfer(
      Address.fromString(DEAD_ADDRESS),
      lpBal,
    );
    const burnTx = await broadcastCall(burnResult, walletAddress, network, provider);
    if (!burnTx.success) throw new Error(`Burn LP failed: ${burnTx.error}`);
  }

  onStep('burn-lp', { status: 'done' });
}
