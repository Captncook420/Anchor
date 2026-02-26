import { useState } from 'react';
import { getContract, OP_20_ABI } from 'opnet';
import type { BitcoinInterfaceAbi } from 'opnet';
import { Address } from '@btc-vision/transaction';
import { PageTransition } from '../components/Layout/PageTransition';
import { Card, CardTitle } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { useWallet } from '../hooks/useWallet';
import { useToast } from '../components/common/Toast';
import { broadcastCall } from '../services/TransactionService';
import { SELL_PRESSURE_ABI } from '../abi/sell-pressure-token.abi';
import { ANCHOR_FACTORY_ABI } from '../abi/anchor-factory.abi';
import { ANCHOR_STAKER_ABI } from '../abi/anchor-staker.abi';
import deployed from '../config/deployed-addresses.json';
import styles from './Admin.module.css';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyContract = any;

const KNOWN = {
  anchorToken: deployed.anchorToken,
  lpPair: deployed.lpToken,
};

export function Admin() {
  const { connected, walletAddress, address, provider, network, connect } = useWallet();
  const { addToast } = useToast();

  // Staker address input (filled after deploying via OPWallet)
  const [stakerAddr, setStakerAddr] = useState(deployed.anchorStaker || '');
  const [factoryAddr, setFactoryAddr] = useState(deployed.anchorFactory || '');
  const [busy, setBusy] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<{ ok: boolean; msg: string } | null>(null);

  async function runCall(label: string, fn: () => Promise<void>) {
    if (!connected || !walletAddress) {
      addToast({ type: 'error', title: 'Error', message: 'Connect wallet first' });
      return;
    }
    setBusy(label);
    setLastResult(null);
    try {
      await fn();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setLastResult({ ok: false, msg });
      addToast({ type: 'error', title: 'Error', message: msg });
    } finally {
      setBusy(null);
    }
  }

  function mergeAbi(...abis: unknown[][]): BitcoinInterfaceAbi {
    return abis.flat() as BitcoinInterfaceAbi;
  }

  // ── 1. setMinter(staker, true) on AnchorToken ──
  async function handleSetMinter() {
    await runCall('setMinter', async () => {
      if (!stakerAddr.startsWith('0x')) throw new Error('Enter a valid staker hex address');
      const contract: AnyContract = getContract(
        KNOWN.anchorToken,
        mergeAbi(OP_20_ABI, SELL_PRESSURE_ABI),
        provider,
        network,
        address ?? undefined,
      );
      const result = await contract.setMinter(Address.fromString(stakerAddr), true);
      const outcome = await broadcastCall(result, walletAddress!, network);
      if (!outcome.success) throw new Error(outcome.error);
      setLastResult({ ok: true, msg: `setMinter TX: ${outcome.transactionId}` });
      addToast({ type: 'success', title: 'Success', message: 'setMinter sent!' });
    });
  }

  // ── 2. setPool(lpPair, true) on AnchorToken ──
  async function handleSetPool() {
    await runCall('setPool', async () => {
      const contract: AnyContract = getContract(
        KNOWN.anchorToken,
        mergeAbi(OP_20_ABI, SELL_PRESSURE_ABI),
        provider,
        network,
        address ?? undefined,
      );
      const result = await contract.setPool(Address.fromString(KNOWN.lpPair), true);
      const outcome = await broadcastCall(result, walletAddress!, network);
      if (!outcome.success) throw new Error(outcome.error);
      setLastResult({ ok: true, msg: `setPool TX: ${outcome.transactionId}` });
      addToast({ type: 'success', title: 'Success', message: 'setPool sent!' });
    });
  }

  // ── 3. setSellPressurePool(lpPair) on AnchorStaker ──
  async function handleSetSellPressurePool() {
    await runCall('setSellPressurePool', async () => {
      if (!stakerAddr.startsWith('0x')) throw new Error('Enter a valid staker hex address');
      const contract: AnyContract = getContract(
        stakerAddr,
        ANCHOR_STAKER_ABI as BitcoinInterfaceAbi,
        provider,
        network,
        address ?? undefined,
      );
      const result = await contract.setSellPressurePool(Address.fromString(KNOWN.lpPair));
      const outcome = await broadcastCall(result, walletAddress!, network);
      if (!outcome.success) throw new Error(outcome.error);
      setLastResult({ ok: true, msg: `setSellPressurePool TX: ${outcome.transactionId}` });
      addToast({ type: 'success', title: 'Success', message: 'setSellPressurePool sent!' });
    });
  }

  // ── 4. setAnchorAddresses(anchorToken, staker) on AnchorFactory ──
  async function handleSetAnchorAddresses() {
    await runCall('setAnchorAddresses', async () => {
      if (!factoryAddr.startsWith('0x')) throw new Error('Enter a valid factory hex address');
      if (!stakerAddr.startsWith('0x')) throw new Error('Enter a valid staker hex address');
      const contract: AnyContract = getContract(
        factoryAddr,
        ANCHOR_FACTORY_ABI as BitcoinInterfaceAbi,
        provider,
        network,
        address ?? undefined,
      );
      const result = await contract.setAnchorAddresses(
        Address.fromString(KNOWN.anchorToken),
        Address.fromString(stakerAddr),
      );
      const outcome = await broadcastCall(result, walletAddress!, network);
      if (!outcome.success) throw new Error(outcome.error);
      setLastResult({ ok: true, msg: `setAnchorAddresses TX: ${outcome.transactionId}` });
      addToast({ type: 'success', title: 'Success', message: 'setAnchorAddresses sent!' });
    });
  }

  if (!connected) {
    return (
      <PageTransition>
        <div className={styles.container}>
          <h1
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 'var(--text-3xl)',
              fontWeight: 700,
              color: 'var(--text-primary)',
            }}
          >
            Admin
          </h1>
          <Card>
            <p style={{ color: 'var(--text-secondary)', marginBottom: 'var(--space-md)' }}>
              Connect your wallet to configure contracts.
            </p>
            <Button onClick={connect}>Connect Wallet</Button>
          </Card>
        </div>
      </PageTransition>
    );
  }

  return (
    <PageTransition>
      <div className={styles.container}>
        <div>
          <h1
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 'var(--text-3xl)',
              fontWeight: 700,
              color: 'var(--text-primary)',
              marginBottom: 'var(--space-xs)',
            }}
          >
            Admin
          </h1>
          <p style={{ color: 'var(--text-secondary)' }}>
            Post-deployment contract configuration. Run these after deploying via OPWallet.
          </p>
        </div>

        {/* Addresses */}
        <Card>
          <CardTitle>Contract Addresses</CardTitle>
          <div className={styles.section}>
            <div className={styles.field}>
              <span className={styles.label}>ANCHOR Token (hardcoded)</span>
              <input
                className={styles.input}
                value={KNOWN.anchorToken}
                readOnly
              />
            </div>
            <div className={styles.field}>
              <span className={styles.label}>LP Pair (hardcoded)</span>
              <input
                className={styles.input}
                value={KNOWN.lpPair}
                readOnly
              />
            </div>
            <div className={styles.field}>
              <span className={styles.label}>AnchorStaker (paste after deploying)</span>
              <input
                className={styles.input}
                placeholder="0x..."
                value={stakerAddr}
                onChange={(e) => setStakerAddr(e.target.value.trim())}
              />
            </div>
            <div className={styles.field}>
              <span className={styles.label}>AnchorFactory (paste after deploying)</span>
              <input
                className={styles.input}
                placeholder="0x..."
                value={factoryAddr}
                onChange={(e) => setFactoryAddr(e.target.value.trim())}
              />
            </div>
          </div>
        </Card>

        {/* Step 1: Configure AnchorToken */}
        <Card>
          <CardTitle>Step 1: Configure AnchorToken</CardTitle>
          <div className={styles.section}>
            <p className={styles.sectionDesc}>
              Authorize the staker to mint ANCHOR rewards, and enable sell-pressure tracking on the LP pair.
            </p>
            <div className={styles.row}>
              <Button
                onClick={handleSetMinter}
                disabled={busy !== null || !stakerAddr}
                fullWidth
              >
                {busy === 'setMinter' ? 'Sending...' : 'setMinter(staker, true)'}
              </Button>
              <Button
                onClick={handleSetPool}
                disabled={busy !== null}
                fullWidth
              >
                {busy === 'setPool' ? 'Sending...' : 'setPool(lpPair, true)'}
              </Button>
            </div>
          </div>
        </Card>

        {/* Step 2: Configure AnchorStaker (optional — already baked into WASM) */}
        <Card>
          <CardTitle>Step 2: Configure AnchorStaker (optional)</CardTitle>
          <div className={styles.section}>
            <p className={styles.sectionDesc}>
              The sell-pressure pool is already set during deployment. Only use this if you need to change it.
            </p>
            <Button
              variant="secondary"
              onClick={handleSetSellPressurePool}
              disabled={busy !== null || !stakerAddr}
              fullWidth
            >
              {busy === 'setSellPressurePool' ? 'Sending...' : 'setSellPressurePool(lpPair)'}
            </Button>
          </div>
        </Card>

        {/* Step 3: Configure AnchorFactory */}
        <Card>
          <CardTitle>Step 3: Configure AnchorFactory</CardTitle>
          <div className={styles.section}>
            <p className={styles.sectionDesc}>
              Tell the factory about the ANCHOR token and staker addresses.
            </p>
            <Button
              onClick={handleSetAnchorAddresses}
              disabled={busy !== null || !stakerAddr || !factoryAddr}
              fullWidth
            >
              {busy === 'setAnchorAddresses' ? 'Sending...' : 'setAnchorAddresses(token, staker)'}
            </Button>
          </div>
        </Card>

        {/* Result display */}
        {lastResult && (
          <div className={lastResult.ok ? styles.statusSuccess : styles.statusError}>
            {lastResult.msg}
          </div>
        )}
      </div>
    </PageTransition>
  );
}
