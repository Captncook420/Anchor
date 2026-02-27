import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import { Address } from '@btc-vision/transaction';
import {
    MOTOSWAP_ROUTER_ABI,
    MotoSwapFactoryAbi,
    OP_20_ABI,
} from 'opnet';
import type {
    IMotoswapRouterContract,
    IMotoswapFactoryContract,
    IOP20Contract,
    BitcoinInterfaceAbi,
} from 'opnet';
import { getContract } from 'opnet';
import {
    initWallet,
    signDeploy,
    broadcastDeployments,
    deployContract,
    broadcastCallContract,
    waitForAllTxs,
    waitForTx,
    buildCalldata,
    refreshUtxos,
    MOTOSWAP_ROUTER,
    MOTOSWAP_FACTORY,
    MOTO_TOKEN,
} from './helpers.js';
import { SellPressureTokenAbi } from '../abis/SellPressureToken.abi.js';
import { AnchorStakerAbi } from '../abis/AnchorStaker.abi.js';
import { AnchorFactoryAbi } from '../abis/AnchorFactory.abi.js';

// ── Build paths ──
const BUILD = path.resolve(import.meta.dirname, '..', 'build');

// ── Readline helper ──
function ask(question: string): Promise<string> {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    return new Promise((resolve) => {
        rl.question(question, (answer) => {
            rl.close();
            resolve(answer.trim());
        });
    });
}

// ── Deploy amounts ──
const ANCHOR_SUPPLY = 1_000_000_000n * 10n ** 18n; // 1B * 1e18
const LP_AMOUNT = (ANCHOR_SUPPLY * 95n) / 100n;    // 95% for LP

// ── Main ──
async function main(): Promise<void> {
    console.log('=== ANCHOR Protocol — Full Deployment (New Factory Architecture) ===\n');

    // ── Init ──
    const ctx = await initWallet();
    const deployer = ctx.wallet.address;

    // Ask for MOTO amount for LP
    const motoInput = await ask('MOTO amount for initial LP (e.g. 1000): ');
    const motoAmount = BigInt(Math.floor(Number(motoInput) * 1e18));
    if (motoAmount <= 0n) throw new Error('Invalid MOTO amount');
    console.log(`  LP: ${LP_AMOUNT} ANCHOR + ${motoAmount} MOTO\n`);

    // ──────────────────────────────────────────────────────────────
    // Steps 1-4: Deploy contracts (or resume from previous run)
    // ──────────────────────────────────────────────────────────────
    // RESUME_FROM: "childTokenTpl,childStakerTpl,factory,token[,lpPair]"
    // If lpPair is provided, skips steps 1-5 entirely (resumes at step 6)
    // If only 4 addresses, skips steps 1-4 (resumes at step 5)
    const resumeFrom = process.env.RESUME_FROM;
    let childTokenTemplate: string;
    let childStakerTemplate: string;
    let anchorFactory: string;
    let anchorToken: string;
    let lpPairOverride: string | undefined;

    if (resumeFrom) {
        const parts = resumeFrom.split(',');
        childTokenTemplate = parts[0];
        childStakerTemplate = parts[1];
        anchorFactory = parts[2];
        anchorToken = parts[3];
        lpPairOverride = parts[4]; // optional — skip LP creation if provided
        console.log(`Resuming from step ${lpPairOverride ? '6' : '5'} with existing contracts:`);
        console.log(`  ChildToken template: ${childTokenTemplate}`);
        console.log(`  ChildStaker template: ${childStakerTemplate}`);
        console.log(`  AnchorFactory: ${anchorFactory}`);
        console.log(`  AnchorToken: ${anchorToken}`);
        if (lpPairOverride) console.log(`  LP Pair: ${lpPairOverride}`);
        console.log('');
    } else {
        // Fresh deploy: sign all 4 locally, broadcast in one batch
        console.log('[1/4] Signing ChildToken template...');
        const signed1 = await signDeploy(ctx, path.join(BUILD, 'ChildToken.wasm'), buildCalldata((w) => {
            w.writeStringWithLength('TEMPLATE');
            w.writeStringWithLength('TPL');
            w.writeAddress(deployer);
        }));
        childTokenTemplate = signed1.contractPubKey;

        console.log('[2/4] Signing ChildStaker template...');
        const signed2 = await signDeploy(ctx, path.join(BUILD, 'ChildStaker.wasm'), buildCalldata((w) => {
            w.writeAddress(deployer); // dummy rewardToken
            w.writeAddress(deployer); // dummy lpToken
            w.writeAddress(deployer); // dev
            w.writeAddress(deployer); // creator
            w.writeAddress(deployer); // anchorToken
            w.writeAddress(deployer); // factory
            w.writeAddress(deployer); // anchorLpPool
        }));
        childStakerTemplate = signed2.contractPubKey;

        console.log('[3/4] Signing AnchorFactory...');
        const signed3 = await signDeploy(ctx, path.join(BUILD, 'AnchorFactory.wasm'), buildCalldata((w) => {
            w.writeAddress(Address.fromString(childTokenTemplate));
            w.writeAddress(Address.fromString(childStakerTemplate));
        }));
        anchorFactory = signed3.contractPubKey;

        console.log('[4/4] Signing AnchorToken...');
        const signed4 = await signDeploy(ctx, path.join(BUILD, 'AnchorToken.wasm'), buildCalldata((w) => {
            w.writeAddress(Address.fromString(anchorFactory));
        }));
        anchorToken = signed4.contractPubKey;

        console.log('\nBroadcasting all 4 deployments...');
        await broadcastDeployments(ctx, [signed1, signed2, signed3, signed4]);
        console.log('All 4 contracts deployed and indexed!');
        await refreshUtxos(ctx);
    }

    // ──────────────────────────────────────────────────────────────
    // Step 5: Approve tokens + Add LP on MotoSwap (skip if LP already exists)
    // ──────────────────────────────────────────────────────────────
    let lpPair: string;

    if (lpPairOverride) {
        lpPair = lpPairOverride;
        console.log(`\n[5/10] Skipping LP creation — using existing LP Pair: ${lpPair}`);
    } else {
        console.log('\n[5/10] Adding ANCHOR/MOTO liquidity on MotoSwap...');

        // OPNet OP20 uses increaseAllowance, not approve
        const anchorContract = getContract<IOP20Contract>(
            anchorToken, OP_20_ABI, ctx.provider, ctx.network, deployer,
        );
        const motoContract = getContract<IOP20Contract>(
            MOTO_TOKEN, OP_20_ABI, ctx.provider, ctx.network, deployer,
        );

        console.log('  Increasing ANCHOR allowance for router...');
        const anchorApproval = await anchorContract.increaseAllowance(
            Address.fromString(MOTOSWAP_ROUTER), LP_AMOUNT,
        );
        if (anchorApproval.revert) throw new Error(`ANCHOR allowance reverted: ${anchorApproval.revert}`);
        const anchorReceipt = await anchorApproval.sendTransaction({
            signer: ctx.wallet.keypair, mldsaSigner: ctx.wallet.mldsaKeypair,
            refundTo: ctx.wallet.p2tr, maximumAllowedSatToSpend: 100_000n,
            feeRate: 10, network: ctx.network,
        });
        console.log(`  ANCHOR allowance TX: ${anchorReceipt.transactionId}`);
        ctx.utxos = anchorReceipt.newUTXOs;

        console.log('  Increasing MOTO allowance for router...');
        const motoApproval = await motoContract.increaseAllowance(
            Address.fromString(MOTOSWAP_ROUTER), motoAmount,
        );
        if (motoApproval.revert) throw new Error(`MOTO allowance reverted: ${motoApproval.revert}`);
        const motoReceipt = await motoApproval.sendTransaction({
            signer: ctx.wallet.keypair, mldsaSigner: ctx.wallet.mldsaKeypair,
            refundTo: ctx.wallet.p2tr, maximumAllowedSatToSpend: 100_000n,
            feeRate: 10, network: ctx.network,
        });
        console.log(`  MOTO allowance TX: ${motoReceipt.transactionId}`);
        ctx.utxos = motoReceipt.newUTXOs;

        console.log('  Waiting for allowances to confirm...');
        await waitForAllTxs(ctx.provider, [anchorReceipt.transactionId, motoReceipt.transactionId]);
        await refreshUtxos(ctx);

        // Add liquidity
        console.log('  Adding liquidity...');
        const router = getContract<IMotoswapRouterContract>(
            MOTOSWAP_ROUTER,
            MOTOSWAP_ROUTER_ABI,
            ctx.provider,
            ctx.network,
            deployer,
        );
        const deadline = BigInt(Math.floor(Date.now() / 1000) + 7200);
        const addLiqResult = await router.addLiquidity(
            Address.fromString(anchorToken),
            Address.fromString(MOTO_TOKEN),
            LP_AMOUNT,
            motoAmount,
            0n,
            0n,
            deployer,
            deadline,
        );
        if (addLiqResult.revert) throw new Error(`addLiquidity reverted: ${addLiqResult.revert}`);
        const liqReceipt = await addLiqResult.sendTransaction({
            signer: ctx.wallet.keypair,
            mldsaSigner: ctx.wallet.mldsaKeypair,
            refundTo: ctx.wallet.p2tr,
            maximumAllowedSatToSpend: 100_000n,
            feeRate: 10,
            network: ctx.network,
        });
        console.log(`  addLiquidity TX: ${liqReceipt.transactionId}`);
        ctx.utxos = liqReceipt.newUTXOs;

        console.log('  Waiting for addLiquidity TX to confirm...');
        await waitForTx(ctx.provider, liqReceipt.transactionId);
        await refreshUtxos(ctx);

        // Get LP pair address
        console.log('  Fetching LP pair address...');
        const motoFactory = getContract<IMotoswapFactoryContract>(
            MOTOSWAP_FACTORY,
            MotoSwapFactoryAbi,
            ctx.provider,
            ctx.network,
            deployer,
        );
        const poolResult = await motoFactory.getPool(
            Address.fromString(anchorToken),
            Address.fromString(MOTO_TOKEN),
        );
        if (poolResult.revert) throw new Error('Failed to get LP pair');
        lpPair = String(poolResult.properties.pool);
        console.log(`  LP Pair: ${lpPair}`);
    }

    // ──────────────────────────────────────────────────────────────
    // Step 6: Deploy AnchorStaker(anchorToken, lpPair, deployer)
    // ──────────────────────────────────────────────────────────────
    console.log('\n[6/10] Deploying AnchorStaker...');
    const stakerCalldata = buildCalldata((w) => {
        w.writeAddress(Address.fromString(anchorToken));  // rewardToken
        w.writeAddress(Address.fromString(lpPair));       // lpToken
        w.writeAddress(deployer);                          // dev
    });
    const { contractPubKey: anchorStaker } = await deployContract(
        ctx, path.join(BUILD, 'AnchorStaker.wasm'), stakerCalldata,
    );
    console.log(`  AnchorStaker: ${anchorStaker}`);
    await refreshUtxos(ctx);

    // ──────────────────────────────────────────────────────────────
    // Steps 7-10: Broadcast all config calls, wait once at the end
    // These are independent state changes — no need to wait between them.
    // ──────────────────────────────────────────────────────────────
    console.log('\n[7-10] Broadcasting all configuration TXs...');
    const configTxs: string[] = [];

    console.log('  [7/10] factory.setAnchorAddresses...');
    configTxs.push(await broadcastCallContract(ctx, anchorFactory, AnchorFactoryAbi as BitcoinInterfaceAbi, 'setAnchorAddresses', [
        Address.fromString(anchorToken),
        Address.fromString(anchorStaker),
        Address.fromString(lpPair),
    ]));

    console.log('  [8/10] anchorToken.setMinter...');
    configTxs.push(await broadcastCallContract(ctx, anchorToken, SellPressureTokenAbi as BitcoinInterfaceAbi, 'setMinter', [
        Address.fromString(anchorStaker),
        true,
    ]));

    console.log('  [9/10] anchorToken.setPool...');
    configTxs.push(await broadcastCallContract(ctx, anchorToken, SellPressureTokenAbi as BitcoinInterfaceAbi, 'setPool', [
        Address.fromString(lpPair),
        true,
    ]));

    console.log('  [10/10] anchorStaker.setSellPressurePool...');
    configTxs.push(await broadcastCallContract(ctx, anchorStaker, AnchorStakerAbi as BitcoinInterfaceAbi, 'setSellPressurePool', [
        Address.fromString(lpPair),
    ]));

    console.log(`\n  All 4 config TXs broadcasted. Waiting for confirmations...`);
    await waitForAllTxs(ctx.provider, configTxs);
    await refreshUtxos(ctx);

    // ──────────────────────────────────────────────────────────────
    // Save addresses
    // ──────────────────────────────────────────────────────────────
    const addresses = {
        childTokenTemplate,
        childStakerTemplate,
        anchorFactory,
        anchorToken,
        anchorStaker,
        lpToken: lpPair,
    };

    const addressesFile = path.resolve(import.meta.dirname, 'addresses.ts');
    const content = `// Auto-generated by deploy.ts — ${new Date().toISOString()}
export const DEPLOYED = ${JSON.stringify(addresses, null, 4)} as const;
`;
    fs.writeFileSync(addressesFile, content);

    // Frontend config
    const frontendJson = path.resolve(
        import.meta.dirname, '..', '..', 'anchor-frontend', 'src', 'config', 'deployed-addresses.json',
    );
    fs.writeFileSync(frontendJson, JSON.stringify(addresses, null, 2) + '\n');
    console.log(`  Frontend addresses written to ${frontendJson}`);

    console.log('\n=== Deployment Complete ===');
    console.log(JSON.stringify(addresses, null, 2));
    console.log(`\nAddresses saved to ${addressesFile}`);

    process.exit(0);
}

main().catch((err) => {
    console.error('\nDeployment failed:', err);
    process.exit(1);
});
