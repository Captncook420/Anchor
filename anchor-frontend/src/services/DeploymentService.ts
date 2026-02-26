import type { AbstractRpcProvider, BitcoinInterfaceAbi, CallResult } from 'opnet';
import {
  getContract,
  OP_20_ABI,
  MOTOSWAP_ROUTER_ABI,
  MotoSwapFactoryAbi,
} from 'opnet';
import type { IMotoswapRouterContract } from 'opnet';
import type { IMotoswapFactoryContract } from 'opnet';
import { Address } from '@btc-vision/transaction';
import type { Network } from '@btc-vision/bitcoin';
import { ANCHOR_FACTORY_ABI } from '../abi/anchor-factory.abi';
import { getContractAddresses } from '../config/contracts';
import { broadcastCall } from './TransactionService';
import {
  MOTO_TOKEN,
  MOTOSWAP_ROUTER,
  MOTOSWAP_FACTORY,
  CHILD_LP_AMOUNT,
} from '../config/dex';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyContract = any;

// ── Types ──

export type StepStatus = 'pending' | 'active' | 'done' | 'error';

export interface LaunchStep {
  readonly id: string;
  readonly label: string;
  status: StepStatus;
  txId?: string;
  error?: string;
  result?: string;
}

export interface LaunchConfig {
  readonly name: string;
  readonly symbol: string;
  readonly motoAmount: bigint; // MOTO amount (18 decimals) for initial LP
}

export interface LaunchResult {
  readonly childToken: string;
  readonly childStaker: string;
  readonly lpPair: string;
}

export const LAUNCH_STEPS: readonly { id: string; label: string }[] = [
  { id: 'deploy-token', label: 'Deploy Token (via Factory)' },
  { id: 'wait-index', label: 'Waiting for contract indexing (~5 min)' },
  { id: 'add-lp', label: 'Add Initial Liquidity' },
  { id: 'finalize', label: 'Finalize (Staker + Config)' },
];

// ── Poll until a contract is indexed by the RPC node ──

async function waitForContractIndexed(
  provider: AbstractRpcProvider,
  contractAddress: string,
  onProgress?: (elapsed: number) => void,
  timeoutMs = 900_000, // 15 min
  pollMs = 15_000, // 15s
): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const code = await provider.getCode(contractAddress, true);
      if (code && (code as Uint8Array).length > 0) return;
    } catch {
      // Not indexed yet — keep polling
    }
    if (onProgress) onProgress(Math.floor((Date.now() - start) / 1000));
    await new Promise((r) => setTimeout(r, pollMs));
  }
  throw new Error(
    `Contract ${contractAddress.slice(0, 16)}… not indexed within ${timeoutMs / 1000}s`,
  );
}

// ── Poll until a TX is confirmed (mined in a block) ──

async function waitForTx(
  provider: AbstractRpcProvider,
  txHash: string,
  onProgress?: (elapsed: number) => void,
  timeoutMs = 900_000, // 15 min
  pollMs = 15_000, // 15s
): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const tx = await provider.getTransaction(txHash);
      if (tx) return;
    } catch {
      // Not confirmed yet
    }
    if (onProgress) onProgress(Math.floor((Date.now() - start) / 1000));
    await new Promise((r) => setTimeout(r, pollMs));
  }
  throw new Error(`TX ${txHash.slice(0, 16)}… not confirmed within ${timeoutMs / 1000}s`);
}

// ── Main Launch Orchestrator ──

export async function launchToken(
  config: LaunchConfig,
  provider: AbstractRpcProvider,
  network: Network,
  walletAddress: string,
  senderAddress: Address,
  onStep: (stepId: string, update: Partial<LaunchStep>) => void,
): Promise<LaunchResult> {
  const addrs = getContractAddresses(network);

  const factoryContract: AnyContract = getContract(
    addrs.anchorFactory,
    ANCHOR_FACTORY_ABI as unknown as BitcoinInterfaceAbi,
    provider,
    network,
    senderAddress,
  );

  // ── Step 1: Deploy ChildToken via factory ──
  onStep('deploy-token', { status: 'active' });

  const deployResult: CallResult = await factoryContract.deployChildToken(
    config.name,
    config.symbol,
  );
  const deployTx = await broadcastCall(deployResult, walletAddress, network, provider);
  if (!deployTx.success) throw new Error(`Deploy token failed: ${deployTx.error}`);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const childTokenAddr = String((deployResult.properties as any).tokenAddress);

  onStep('deploy-token', {
    status: 'done',
    result: childTokenAddr,
    txId: deployTx.transactionId,
  });

  // ── Step 1.5: Wait for the child token to be indexed ──
  onStep('wait-index', { status: 'active' });

  await waitForContractIndexed(provider, childTokenAddr, (elapsed) => {
    onStep('wait-index', {
      status: 'active',
      result: `${elapsed}s elapsed…`,
    });
  });

  onStep('wait-index', { status: 'done', result: 'Contract indexed' });

  // ── Step 2: Add Initial Liquidity on MotoSwap ──
  onStep('add-lp', { status: 'active' });

  // Approve child tokens for router
  const childTokenContract: AnyContract = getContract(
    childTokenAddr,
    OP_20_ABI,
    provider,
    network,
    senderAddress,
  );

  onStep('add-lp', { status: 'active', result: 'Approving child token…' });
  const approveChildResult: CallResult = await childTokenContract.increaseAllowance(
    Address.fromString(MOTOSWAP_ROUTER),
    CHILD_LP_AMOUNT,
  );
  const approveTx = await broadcastCall(approveChildResult, walletAddress, network, provider);
  if (!approveTx.success) throw new Error(`Approve child token failed: ${approveTx.error}`);

  // Approve MOTO for router
  const motoContract: AnyContract = getContract(
    MOTO_TOKEN,
    OP_20_ABI,
    provider,
    network,
    senderAddress,
  );

  onStep('add-lp', { status: 'active', result: 'Approving MOTO…' });
  const approveMotoResult: CallResult = await motoContract.increaseAllowance(
    Address.fromString(MOTOSWAP_ROUTER),
    config.motoAmount,
  );
  const approveMotoTx = await broadcastCall(approveMotoResult, walletAddress, network, provider);
  if (!approveMotoTx.success) throw new Error(`Approve MOTO failed: ${approveMotoTx.error}`);

  // Wait for BOTH approval TXs to confirm before addLiquidity
  onStep('add-lp', { status: 'active', result: 'Waiting for approvals to confirm (~5 min)…' });
  await waitForTx(provider, approveTx.transactionId, (elapsed) => {
    onStep('add-lp', { status: 'active', result: `Waiting for approvals… ${elapsed}s` });
  });
  await waitForTx(provider, approveMotoTx.transactionId);

  // Add liquidity (now that allowances are on-chain)
  onStep('add-lp', { status: 'active', result: 'Adding liquidity…' });
  const router = getContract<IMotoswapRouterContract>(
    MOTOSWAP_ROUTER,
    MOTOSWAP_ROUTER_ABI,
    provider,
    network,
    senderAddress,
  );

  const deadline = BigInt(Math.floor(Date.now() / 1000) + 3600);
  const addLiqResult = await router.addLiquidity(
    Address.fromString(childTokenAddr),
    Address.fromString(MOTO_TOKEN),
    CHILD_LP_AMOUNT,
    config.motoAmount,
    0n, // no slippage for initial LP
    0n,
    senderAddress,
    deadline,
  );
  const addLiqTx = await broadcastCall(addLiqResult, walletAddress, network, provider);
  if (!addLiqTx.success) throw new Error(`Add liquidity failed: ${addLiqTx.error}`);

  // Wait for addLiquidity TX to confirm before querying the LP pair
  onStep('add-lp', { status: 'active', result: 'Waiting for LP TX to confirm…' });
  await waitForTx(provider, addLiqTx.transactionId, (elapsed) => {
    onStep('add-lp', { status: 'active', result: `Waiting for LP TX… ${elapsed}s` });
  });

  // Get LP pair address from MotoSwap factory
  const motoFactory = getContract<IMotoswapFactoryContract>(
    MOTOSWAP_FACTORY,
    MotoSwapFactoryAbi,
    provider,
    network,
    senderAddress,
  );

  const poolResult = await motoFactory.getPool(
    Address.fromString(childTokenAddr),
    Address.fromString(MOTO_TOKEN),
  );
  if (poolResult.revert) throw new Error('Failed to get LP pair address');

  const lpPairAddr = String(poolResult.properties.pool);

  onStep('add-lp', {
    status: 'done',
    result: lpPairAddr,
    txId: addLiqTx.transactionId,
  });

  // ── Step 3: Finalize (factory deploys staker + configures everything + registers) ──
  onStep('finalize', { status: 'active' });

  const finalizeResult: CallResult = await factoryContract.finalizeChild(
    Address.fromString(childTokenAddr),
    Address.fromString(lpPairAddr),
  );
  const finalizeTx = await broadcastCall(finalizeResult, walletAddress, network, provider);
  if (!finalizeTx.success) throw new Error(`Finalize failed: ${finalizeTx.error}`);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const childStakerAddr = String((finalizeResult.properties as any).stakerAddress);

  // Wait for finalize TX to confirm so the factory registry is on-chain
  onStep('finalize', { status: 'active', result: 'Waiting for finalize TX to confirm…' });
  await waitForTx(provider, finalizeTx.transactionId, (elapsed) => {
    onStep('finalize', { status: 'active', result: `Waiting for finalize TX… ${elapsed}s` });
  });

  onStep('finalize', {
    status: 'done',
    result: childStakerAddr,
    txId: finalizeTx.transactionId,
  });

  return {
    childToken: childTokenAddr,
    childStaker: childStakerAddr,
    lpPair: lpPairAddr,
  };
}
