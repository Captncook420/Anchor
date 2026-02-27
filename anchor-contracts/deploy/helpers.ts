import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import { networks, type Network } from '@btc-vision/bitcoin';
import {
    Address,
    AddressTypes,
    BinaryWriter,
    Mnemonic,
    MLDSASecurityLevel,
    TransactionFactory,
    Wallet,
    UTXO,
    DeploymentResult,
} from '@btc-vision/transaction';
import {
    JSONRpcProvider,
    getContract,
    IOP20Contract,
    OP_20_ABI,
    CallResult,
    TransactionParameters,
    ContractDecodedObjectResult,
    BitcoinInterfaceAbi,
} from 'opnet';
import 'dotenv/config';

// ── Network ──
export const NETWORK: Network = networks.opnetTestnet;
export const RPC_URL = process.env.RPC_URL ?? 'https://testnet.opnet.org';

// ── MotoSwap addresses (testnet) ──
export const MOTOSWAP_ROUTER =
    '0x0e6ff1f2d7db7556cb37729e3738f4dae82659b984b2621fab08e1111b1b937a';
export const MOTOSWAP_FACTORY =
    '0xa02aa5ca4c307107484d5fb690d811df1cf526f8de204d24528653dcae369a0f';
export const MOTO_TOKEN =
    '0xfd4473840751d58d9f8b73bdd57d6c5260453d5518bd7cd02d0a4cf3df9bf4dd';

// ── Transaction defaults ──
const MAX_SAT_SPEND = 100_000n;
const FEE_RATE = 10;
const PRIORITY_FEE = 50_000n;
const GAS_SAT_FEE = 50_000n;

// ── Wallet init ──
export interface WalletContext {
    wallet: Wallet;
    provider: JSONRpcProvider;
    network: Network;
    factory: TransactionFactory;
    utxos: UTXO[];
}

// Reads a single line from stdin. Handles long pastes that Windows terminals
// may split across multiple chunks by accumulating until a newline.
async function promptSecret(question: string): Promise<string> {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
    });

    return new Promise((resolve) => {
        rl.question(question, (answer) => {
            rl.close();
            // Strip any stray whitespace / newlines from pasted input
            resolve(answer.replace(/\s+/g, '').trim());
        });
    });
}

export async function initWallet(): Promise<WalletContext> {
    const pk = await promptSecret('Paste private key (WIF or hex): ');
    if (!pk) throw new Error('Private key is required.');
    const mldsa = await promptSecret('Paste ML-DSA key (hex): ');
    if (!mldsa) throw new Error('ML-DSA key is required.');

    const wallet = new Wallet(pk, mldsa, NETWORK);

    const provider = new JSONRpcProvider({ url: RPC_URL, network: NETWORK });
    const factory = new TransactionFactory();

    console.log(`Wallet P2TR: ${wallet.p2tr}`);

    // Clean UTXO cache to avoid stale data from recent transactions
    provider.utxoManager.clean();

    const utxos = await provider.utxoManager.getUTXOs({
        address: wallet.p2tr,
        optimize: true,
        mergePendingUTXOs: true,
        filterSpentUTXOs: true,
    });

    console.log(`UTXOs found: ${utxos.length}`);
    if (utxos.length === 0) {
        throw new Error('No UTXOs found. Fund the wallet before deploying.');
    }

    return { wallet, provider, network: NETWORK, factory, utxos };
}

// ── Build base transaction params (backend: always include signers) ──
function baseTxParams(ctx: WalletContext): TransactionParameters {
    return {
        signer: ctx.wallet.keypair,
        mldsaSigner: ctx.wallet.mldsaKeypair,
        refundTo: ctx.wallet.p2tr,
        maximumAllowedSatToSpend: MAX_SAT_SPEND,
        feeRate: FEE_RATE,
        network: ctx.network,
    };
}

// ── Refresh UTXOs ──
export async function refreshUtxos(ctx: WalletContext): Promise<void> {
    ctx.provider.utxoManager.clean();
    ctx.utxos = await ctx.provider.utxoManager.getUTXOs({
        address: ctx.wallet.p2tr,
        optimize: true,
        mergePendingUTXOs: true,
        filterSpentUTXOs: true,
    });
}

// ── Wait for transaction to be mined ──
// Testnet blocks are ~5 minutes, so be patient
export async function waitForTx(
    provider: JSONRpcProvider,
    txHash: string,
    timeoutMs = 900_000, // 15 min
): Promise<void> {
    const start = Date.now();
    const pollInterval = 10_000; // 10s between polls

    console.log(`  Waiting for TX ${txHash.slice(0, 16)}... (blocks ~5 min)`);

    while (Date.now() - start < timeoutMs) {
        try {
            const tx = await provider.getTransaction(txHash);
            if (tx) {
                const elapsed = ((Date.now() - start) / 1000).toFixed(0);
                console.log(`  TX confirmed after ${elapsed}s`);
                return;
            }
        } catch {
            // Not found yet
        }
        const elapsed = ((Date.now() - start) / 1000).toFixed(0);
        process.stdout.write(`\r  Waiting... ${elapsed}s elapsed`);
        await sleep(pollInterval);
    }
    console.log('');
    throw new Error(`TX ${txHash} not confirmed within ${timeoutMs / 1000}s`);
}

// ── Wait for contract to be indexed (poll getCode) ──
export async function waitForContract(
    provider: JSONRpcProvider,
    contractAddress: string,
    timeoutMs = 900_000, // 15 minutes
): Promise<void> {
    const start = Date.now();
    const pollInterval = 15_000;

    console.log(`  Waiting for contract to be indexed...`);

    while (Date.now() - start < timeoutMs) {
        try {
            const code = await provider.getCode(contractAddress, true);
            if (code && (code as Uint8Array).length > 0) {
                console.log('  Contract indexed successfully');
                return;
            }
        } catch {
            // Not indexed yet
        }
        await sleep(pollInterval);
    }
    throw new Error(`Contract ${contractAddress} not indexed within ${timeoutMs / 1000}s`);
}

// ── Signed deployment (not yet broadcast) ──
export interface SignedDeployment {
    contractAddress: string;
    contractPubKey: string;
    fundingTxHex: string;
    deployTxHex: string;
    utxos: UTXO[];
}

// ── Sign a deployment locally — no broadcast, no waiting ──
// Returns signed TXs + deterministic contract address.
// Updates ctx.utxos so the next call chains from change outputs.
export async function signDeploy(
    ctx: WalletContext,
    wasmPath: string,
    calldata?: Buffer,
): Promise<SignedDeployment> {
    const bytecode = fs.readFileSync(path.resolve(wasmPath));
    const challenge = await ctx.provider.getChallenge();

    const result: DeploymentResult = await ctx.factory.signDeployment({
        from: ctx.wallet.p2tr,
        utxos: ctx.utxos,
        signer: ctx.wallet.keypair,
        mldsaSigner: ctx.wallet.mldsaKeypair,
        network: ctx.network,
        feeRate: FEE_RATE,
        priorityFee: PRIORITY_FEE,
        gasSatFee: GAS_SAT_FEE,
        bytecode: Buffer.from(bytecode),
        challenge,
        linkMLDSAPublicKeyToAddress: true,
        revealMLDSAPublicKey: true,
        ...(calldata ? { calldata } : {}),
    });

    const [fundingTxHex, deployTxHex] = result.transaction;
    ctx.utxos = result.utxos; // chain UTXOs for next signing

    console.log(`  Signed: ${result.contractPubKey}`);
    return {
        contractAddress: result.contractAddress,
        contractPubKey: result.contractPubKey,
        fundingTxHex,
        deployTxHex,
        utxos: result.utxos,
    };
}

// ── Broadcast signed deployments + wait for all to confirm & index ──
export async function broadcastDeployments(
    ctx: WalletContext,
    deployments: SignedDeployment[],
): Promise<void> {
    const deployTxIds: string[] = [];

    // Broadcast all TXs — retry deploy TX if node hasn't processed funding TX yet
    for (const dep of deployments) {
        const fundRes = await ctx.provider.sendRawTransaction(dep.fundingTxHex, false);
        if (!fundRes.success) {
            throw new Error(`Funding TX failed for ${dep.contractPubKey}: ${fundRes.error ?? fundRes.result ?? 'unknown'}`);
        }
        console.log(`  Funding TX: ${fundRes.result}`);

        // Retry deploy TX up to 5 times — node may need time to process funding TX
        let depRes: { success: boolean; result?: string; error?: string } | null = null;
        for (let attempt = 0; attempt < 5; attempt++) {
            if (attempt > 0) {
                console.log(`  Deploy TX retry ${attempt}/4 — waiting ${attempt * 2}s...`);
                await sleep(attempt * 2000);
            }
            depRes = await ctx.provider.sendRawTransaction(dep.deployTxHex, false);
            if (depRes.success) break;
            console.warn(`  Deploy TX attempt ${attempt + 1} failed: ${depRes.error ?? depRes.result ?? 'unknown'}`);
        }
        if (!depRes?.success) {
            throw new Error(`Deploy TX failed after 5 attempts for ${dep.contractPubKey}: ${depRes?.error ?? depRes?.result ?? 'unknown'}`);
        }
        console.log(`  Deploy TX: ${depRes.result}`);
        if (depRes.result) deployTxIds.push(depRes.result);
    }

    // Wait for ALL deploy TXs in parallel
    console.log(`  Waiting for ${deployTxIds.length} deploy TXs to confirm...`);
    await Promise.all(deployTxIds.map((h) => waitForTx(ctx.provider, h)));

    // Wait for ALL contracts to be indexed in parallel
    console.log(`  Waiting for ${deployments.length} contracts to be indexed...`);
    await Promise.all(deployments.map((d) => waitForContract(ctx.provider, d.contractAddress)));

    ctx.utxos = deployments[deployments.length - 1].utxos;
}

// ── Deploy single contract (convenience wrapper, with UTXO retry) ──
export async function deployContract(
    ctx: WalletContext,
    wasmPath: string,
    calldata?: Buffer,
): Promise<{ contractAddress: string; contractPubKey: string; utxos: UTXO[] }> {
    let signed = await signDeploy(ctx, wasmPath, calldata);
    try {
        await broadcastDeployments(ctx, [signed]);
    } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        if (msg.includes('Could not decode transaction')) {
            console.warn('  UTXO stale — refreshing and re-signing...');
            await sleep(3000);
            await refreshUtxos(ctx);
            signed = await signDeploy(ctx, wasmPath, calldata);
            await broadcastDeployments(ctx, [signed]);
        } else {
            throw err;
        }
    }
    console.log(`  Contract deployed at: ${signed.contractAddress} (${signed.contractPubKey})`);
    return { contractAddress: signed.contractAddress, contractPubKey: signed.contractPubKey, utxos: signed.utxos };
}

// ── Call a contract method (simulate → sendTransaction) ──
export async function callContract<T extends ContractDecodedObjectResult = ContractDecodedObjectResult>(
    ctx: WalletContext,
    contractAddr: string,
    abi: BitcoinInterfaceAbi,
    methodName: string,
    args: unknown[],
): Promise<CallResult<T>> {
    const contract = getContract<IOP20Contract>(
        contractAddr,
        abi,
        ctx.provider,
        ctx.network,
        ctx.wallet.address,
    );

    // Simulate the call
    const method = (contract as unknown as Record<string, Function>)[methodName];
    if (typeof method !== 'function') {
        throw new Error(`Method ${methodName} not found on contract`);
    }
    const callResult: CallResult<T> = await method.apply(contract, args);

    if (callResult.revert) {
        throw new Error(`Simulation reverted: ${callResult.revert}`);
    }

    // Send the transaction
    const receipt = await callResult.sendTransaction(baseTxParams(ctx));

    console.log(`  ${methodName} TX: ${receipt.transactionId}`);
    await waitForTx(ctx.provider, receipt.transactionId);

    // Update UTXOs
    ctx.utxos = receipt.newUTXOs;

    return callResult;
}

// ── Broadcast a contract call without waiting (for batching) ──
// Simulates, broadcasts, updates UTXOs, returns txHash. Caller waits later.
export async function broadcastCallContract(
    ctx: WalletContext,
    contractAddr: string,
    abi: BitcoinInterfaceAbi,
    methodName: string,
    args: unknown[],
): Promise<string> {
    const contract = getContract<IOP20Contract>(
        contractAddr,
        abi,
        ctx.provider,
        ctx.network,
        ctx.wallet.address,
    );

    const method = (contract as unknown as Record<string, Function>)[methodName];
    if (typeof method !== 'function') {
        throw new Error(`Method ${methodName} not found on contract`);
    }
    const callResult = await method.apply(contract, args);

    if (callResult.revert) {
        throw new Error(`Simulation reverted: ${callResult.revert}`);
    }

    const receipt = await callResult.sendTransaction(baseTxParams(ctx));
    console.log(`  ${methodName} TX: ${receipt.transactionId}`);

    // Update UTXOs for the next call in the batch
    ctx.utxos = receipt.newUTXOs;

    return receipt.transactionId;
}

// ── Wait for multiple TXs (polls all in parallel) ──
export async function waitForAllTxs(
    provider: JSONRpcProvider,
    txHashes: string[],
    timeoutMs = 900_000,
): Promise<void> {
    console.log(`  Waiting for ${txHashes.length} TXs to confirm...`);
    await Promise.all(txHashes.map((h) => waitForTx(provider, h, timeoutMs)));
}

// ── Call a view method (simulate only, no send) ──
export async function viewContract<T extends ContractDecodedObjectResult = ContractDecodedObjectResult>(
    ctx: WalletContext,
    contractAddr: string,
    abi: BitcoinInterfaceAbi,
    methodName: string,
    args: unknown[],
): Promise<T> {
    const contract = getContract<IOP20Contract>(
        contractAddr,
        abi,
        ctx.provider,
        ctx.network,
        ctx.wallet.address,
    );

    const method = (contract as unknown as Record<string, Function>)[methodName];
    if (typeof method !== 'function') {
        throw new Error(`Method ${methodName} not found on contract`);
    }
    const callResult: CallResult<T> = await method.apply(contract, args);

    if (callResult.revert) {
        throw new Error(`View call reverted: ${callResult.revert}`);
    }

    return callResult.properties;
}

// ── Build deployment calldata using BinaryWriter ──
export function buildCalldata(fn: (w: BinaryWriter) => void): Buffer {
    const writer = new BinaryWriter();
    fn(writer);
    return Buffer.from(writer.getBuffer());
}

// ── Sleep helper ──
export function sleep(ms: number): Promise<void> {
    return new Promise((r) => setTimeout(r, ms));
}
