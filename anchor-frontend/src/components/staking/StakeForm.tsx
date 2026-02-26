import { useState, useCallback, useEffect, useRef, type CSSProperties } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card } from '../common/Card';
import { Button } from '../common/Button';
import { TabGroup } from '../common/TabGroup';
import { useWallet } from '../../hooks/useWallet';
import { useWalletBalance } from '../../hooks/useWalletBalance';
import { useStakingPosition } from '../../hooks/useStakingPosition';
import { useRewardsBreakdown } from '../../hooks/useRewardsBreakdown';
import { useTransactionHistory } from '../../hooks/useTransactionHistory';
import { useProtocolStats } from '../../hooks/useProtocolStats';
import { useDexActions } from '../../hooks/useDexActions';
import { getAnchorStaker, getLpToken } from '../../services/ContractService';
import { broadcastCall, ensureAllowance } from '../../services/TransactionService';
import { getContractAddress } from '../../config/contracts';
import { Address } from '@btc-vision/transaction';
import { numberToBigint, bigintToNumber } from '../../utils/bigint';
import { formatNumber } from '../../utils/format';
import { useToast } from '../common/Toast';
import type { TabId } from '../../types';

const TABS = [
  { id: 'stake', label: 'Stake' },
  { id: 'unstake', label: 'Unstake' },
  { id: 'claim', label: 'Claim' },
  { id: 'compound', label: 'Compound' },
  { id: 'buy', label: 'Buy' },
  { id: 'sell', label: 'Sell' },
  { id: 'lp', label: 'LP' },
];

export function StakeForm() {
  const [activeTab, setActiveTab] = useState<TabId>('stake');
  const [amount, setAmount] = useState('');
  const [busy, setBusy] = useState(false);
  // 'approve' = needs approval, 'waiting' = TX sent polling for confirmation, 'ready' = can stake
  const [approvalState, setApprovalState] = useState<'approve' | 'waiting' | 'ready'>('approve');
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const { addToast } = useToast();
  const { connected, provider, network, address, walletAddress } = useWallet();
  const { balances, refresh: refreshBalances } = useWalletBalance();
  const { position, refresh: refreshPosition } = useStakingPosition();
  const { rewards, refresh: refreshRewards } = useRewardsBreakdown();
  const { stats } = useProtocolStats();
  const { addTransaction } = useTransactionHistory();

  // DEX actions for ANCHOR token
  const anchorTokenAddr = getContractAddress('anchorToken', network);
  const dex = useDexActions(anchorTokenAddr);
  const [buyAmount, setBuyAmount] = useState('');
  const [sellAmount, setSellAmount] = useState('');
  const [lpTokenAmount, setLpTokenAmount] = useState('');
  const [lpMotoAmount, setLpMotoAmount] = useState('');
  const buyQuoteTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sellQuoteTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const refreshAll = useCallback(() => {
    refreshBalances();
    refreshPosition();
    refreshRewards();
    dex.refresh();
  }, [refreshBalances, refreshPosition, refreshRewards, dex.refresh]);

  // Check on-chain allowance (returns 0n on any error)
  const checkAllowance = useCallback(async (): Promise<bigint> => {
    if (!address || !provider || !network) return 0n;
    try {
      const lpToken = getLpToken(provider, network, address);
      const stakerAddr = getContractAddress('anchorStaker', network);
      const result = await lpToken.allowance(address, Address.fromString(stakerAddr));
      return result.properties?.remaining ?? 0n;
    } catch {
      return 0n;
    }
  }, [address, provider, network]);

  // On mount, check if approval already exists
  useEffect(() => {
    if (!connected || !address) return;
    checkAllowance().then((val) => {
      if (val > 0n) setApprovalState('ready');
    });
  }, [connected, address, checkAllowance]);

  // Clean up polling on unmount
  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  // Start polling allowance after approval TX is sent
  const startPolling = useCallback(() => {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      const val = await checkAllowance();
      if (val > 0n) {
        if (pollRef.current) clearInterval(pollRef.current);
        pollRef.current = null;
        setApprovalState('ready');
        addToast({ type: 'success', title: 'Approval Confirmed', message: 'You can now stake your LP tokens.' });
      }
    }, 15_000); // poll every 15s
  }, [checkAllowance, addToast]);

  const handleApprove = useCallback(async () => {
    if (!connected || !address || !walletAddress) return;
    setBusy(true);
    try {
      const lpToken = getLpToken(provider, network, address);
      const stakerAddr = getContractAddress('anchorStaker', network);
      const maxAllowance = BigInt('0x7fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff');
      const approvalOutcome = await ensureAllowance(lpToken, address, stakerAddr, maxAllowance, walletAddress, network, provider);
      if (approvalOutcome && !approvalOutcome.success) {
        addToast({ type: 'error', title: 'Approval Failed', message: approvalOutcome.error });
        return;
      }
      addToast({ type: 'info', title: 'Approval Sent', message: 'Waiting for on-chain confirmation. This takes ~5 min.' });
      setApprovalState('waiting');
      startPolling();
    } catch (err) {
      addToast({ type: 'error', title: 'Approval Error', message: err instanceof Error ? err.message : 'Unknown error' });
    } finally {
      setBusy(false);
    }
  }, [connected, address, walletAddress, provider, network, addToast, startPolling]);

  const handleStake = useCallback(async () => {
    if (!connected || !address || !walletAddress || !amount) return;
    setBusy(true);
    try {
      const amountBigint = numberToBigint(Number(amount));

      const staker = getAnchorStaker(provider, network, address);
      const callResult = await staker.stake(amountBigint);
      const outcome = await broadcastCall(callResult, walletAddress, network, provider);

      if (outcome.success) {
        addToast({ type: 'success', title: 'Stake Submitted', message: `Staked ${amount} LP tokens.` });
        addTransaction({ type: 'stake', amount: Number(amount), tokenSymbol: 'ANCHOR', timestamp: Date.now(), status: 'pending', txHash: outcome.transactionId });
        setAmount('');
        refreshAll();
      } else {
        addToast({ type: 'error', title: 'Stake Failed', message: outcome.error });
      }
    } catch (err) {
      addToast({ type: 'error', title: 'Stake Error', message: err instanceof Error ? err.message : 'Unknown error' });
    } finally {
      setBusy(false);
    }
  }, [connected, address, walletAddress, amount, provider, network, addToast, addTransaction, refreshAll]);

  const handleUnstake = useCallback(async () => {
    if (!connected || !address || !walletAddress || !amount) return;
    setBusy(true);
    try {
      const amountBigint = numberToBigint(Number(amount));
      const staker = getAnchorStaker(provider, network, address);
      const callResult = await staker.unstake(amountBigint);
      const outcome = await broadcastCall(callResult, walletAddress, network, provider);

      if (outcome.success) {
        addToast({ type: 'success', title: 'Unstake Submitted', message: `Unstaking ${amount} LP tokens.` });
        addTransaction({ type: 'unstake', amount: Number(amount), tokenSymbol: 'ANCHOR', timestamp: Date.now(), status: 'pending', txHash: outcome.transactionId });
        setAmount('');
        refreshAll();
      } else {
        addToast({ type: 'error', title: 'Unstake Failed', message: outcome.error });
      }
    } catch (err) {
      addToast({ type: 'error', title: 'Unstake Error', message: err instanceof Error ? err.message : 'Unknown error' });
    } finally {
      setBusy(false);
    }
  }, [connected, address, walletAddress, amount, provider, network, addToast, addTransaction, refreshAll]);

  const handleClaim = useCallback(async () => {
    if (!connected || !address || !walletAddress) return;
    setBusy(true);
    try {
      const staker = getAnchorStaker(provider, network, address);
      const callResult = await staker.claim();
      const outcome = await broadcastCall(callResult, walletAddress, network, provider);

      if (outcome.success) {
        addToast({ type: 'success', title: 'Claim Submitted', message: `Claiming ${formatNumber(rewards.totalClaimable)} ANCHOR.` });
        addTransaction({ type: 'claim', amount: rewards.totalClaimable, tokenSymbol: 'ANCHOR', timestamp: Date.now(), status: 'pending', txHash: outcome.transactionId });
        refreshAll();
      } else {
        addToast({ type: 'error', title: 'Claim Failed', message: outcome.error });
      }
    } catch (err) {
      addToast({ type: 'error', title: 'Claim Error', message: err instanceof Error ? err.message : 'Unknown error' });
    } finally {
      setBusy(false);
    }
  }, [connected, address, walletAddress, provider, network, rewards.totalClaimable, addToast, addTransaction, refreshAll]);

  const [compoundAmount, setCompoundAmount] = useState('');

  const handleCompoundAnchorChange = useCallback((val: string) => {
    setCompoundAmount(val);
    const num = parseFloat(val);
    if (!num || num <= 0) { setCompoundMoto(''); return; }
    const matched = dex.getMatchingAmount(numberToBigint(num), true);
    if (matched > 0n) setCompoundMoto(bigintToNumber(matched).toString());
    else setCompoundMoto('');
  }, [dex.getMatchingAmount]);

  const [compoundMoto, setCompoundMoto] = useState('');

  const handleCompoundMotoChange = useCallback((val: string) => {
    setCompoundMoto(val);
    const num = parseFloat(val);
    if (!num || num <= 0) { setCompoundAmount(''); return; }
    const matched = dex.getMatchingAmount(numberToBigint(num), false);
    if (matched > 0n) {
      const capped = Math.min(bigintToNumber(matched), rewards.totalClaimable);
      setCompoundAmount(capped.toString());
    } else setCompoundAmount('');
  }, [dex.getMatchingAmount, rewards.totalClaimable]);

  const handleCompound = useCallback(async () => {
    if (!connected || !address || !walletAddress) return;
    const anchorVal = parseFloat(compoundAmount);
    const motoVal = parseFloat(compoundMoto);
    if (!anchorVal || anchorVal <= 0 || !motoVal || motoVal <= 0) return;
    setBusy(true);
    try {
      const compoundBigint = numberToBigint(anchorVal);
      const staker = getAnchorStaker(provider, network, address);
      const callResult = await staker.compound(compoundBigint);
      const outcome = await broadcastCall(callResult, walletAddress, network, provider);

      if (outcome.success) {
        addToast({ type: 'success', title: 'Compound Submitted', message: `Compounding ${formatNumber(anchorVal)} ANCHOR. After confirmation, add LP with ${formatNumber(motoVal)} MOTO.` });
        addTransaction({ type: 'compound', amount: anchorVal, tokenSymbol: 'ANCHOR', timestamp: Date.now(), status: 'pending', txHash: outcome.transactionId });
        setCompoundAmount('');
        setCompoundMoto('');
        refreshAll();
      } else {
        addToast({ type: 'error', title: 'Compound Failed', message: outcome.error });
      }
    } catch (err) {
      addToast({ type: 'error', title: 'Compound Error', message: err instanceof Error ? err.message : 'Unknown error' });
    } finally {
      setBusy(false);
    }
  }, [connected, address, walletAddress, provider, network, compoundAmount, compoundMoto, addToast, addTransaction, refreshAll]);

  // ── Buy / Sell / LP handlers ──

  const handleBuyInputChange = useCallback((val: string) => {
    setBuyAmount(val);
    if (buyQuoteTimer.current) clearTimeout(buyQuoteTimer.current);
    const num = parseFloat(val);
    if (!num || num <= 0) { void dex.getBuyQuote(0n); return; }
    buyQuoteTimer.current = setTimeout(() => void dex.getBuyQuote(numberToBigint(num)), 400);
  }, [dex.getBuyQuote]);

  const handleSellInputChange = useCallback((val: string) => {
    setSellAmount(val);
    if (sellQuoteTimer.current) clearTimeout(sellQuoteTimer.current);
    const num = parseFloat(val);
    if (!num || num <= 0) { void dex.getSellQuote(0n); return; }
    sellQuoteTimer.current = setTimeout(() => void dex.getSellQuote(numberToBigint(num)), 400);
  }, [dex.getSellQuote]);

  const handleBuy = useCallback(async () => {
    const val = parseFloat(buyAmount);
    if (!val || val <= 0) return;
    try {
      const txId = await dex.buy(numberToBigint(val));
      addToast({ type: 'success', title: 'Buy Submitted', message: `Bought ANCHOR with ${val.toLocaleString()} MOTO. TX: ${txId.slice(0, 12)}...` });
      addTransaction({ type: 'buy', amount: val, tokenSymbol: 'ANCHOR', timestamp: Date.now(), status: 'pending', txHash: txId });
      setBuyAmount('');
      refreshAll();
    } catch (err) {
      addToast({ type: 'error', title: 'Buy Failed', message: err instanceof Error ? err.message : 'Unknown error' });
    }
  }, [buyAmount, dex.buy, addToast, addTransaction, refreshAll]);

  const handleSell = useCallback(async () => {
    const val = parseFloat(sellAmount);
    if (!val || val <= 0) return;
    try {
      const txId = await dex.sell(numberToBigint(val));
      addToast({ type: 'success', title: 'Sell Submitted', message: `Sold ${val.toLocaleString()} ANCHOR for MOTO. TX: ${txId.slice(0, 12)}...` });
      addTransaction({ type: 'sell', amount: val, tokenSymbol: 'ANCHOR', timestamp: Date.now(), status: 'pending', txHash: txId });
      setSellAmount('');
      refreshAll();
    } catch (err) {
      addToast({ type: 'error', title: 'Sell Failed', message: err instanceof Error ? err.message : 'Unknown error' });
    }
  }, [sellAmount, dex.sell, addToast, addTransaction, refreshAll]);

  // LP auto-calculation: typing one side auto-fills the other
  const handleLpTokenChange = useCallback((val: string) => {
    setLpTokenAmount(val);
    const num = parseFloat(val);
    if (!num || num <= 0) { setLpMotoAmount(''); return; }
    const matched = dex.getMatchingAmount(numberToBigint(num), true);
    if (matched > 0n) setLpMotoAmount(bigintToNumber(matched).toString());
  }, [dex.getMatchingAmount]);

  const handleLpMotoChange = useCallback((val: string) => {
    setLpMotoAmount(val);
    const num = parseFloat(val);
    if (!num || num <= 0) { setLpTokenAmount(''); return; }
    const matched = dex.getMatchingAmount(numberToBigint(num), false);
    if (matched > 0n) setLpTokenAmount(bigintToNumber(matched).toString());
  }, [dex.getMatchingAmount]);

  const handleAddLiquidity = useCallback(async () => {
    const tokenVal = parseFloat(lpTokenAmount);
    const motoVal = parseFloat(lpMotoAmount);
    if (!tokenVal || tokenVal <= 0 || !motoVal || motoVal <= 0) return;
    try {
      const txId = await dex.addLiquidity(numberToBigint(tokenVal), numberToBigint(motoVal));
      addToast({ type: 'success', title: 'Liquidity Added', message: `Added ${tokenVal.toLocaleString()} ANCHOR + ${motoVal.toLocaleString()} MOTO. TX: ${txId.slice(0, 12)}...` });
      addTransaction({ type: 'lp', amount: tokenVal, tokenSymbol: 'ANCHOR', motoAmount: motoVal, timestamp: Date.now(), status: 'pending', txHash: txId });
      setLpTokenAmount('');
      setLpMotoAmount('');
      refreshAll();
    } catch (err) {
      addToast({ type: 'error', title: 'Add LP Failed', message: err instanceof Error ? err.message : 'Unknown error' });
    }
  }, [lpTokenAmount, lpMotoAmount, dex.addLiquidity, addToast, addTransaction, refreshAll]);

  const slideDirection = TABS.findIndex((t) => t.id === activeTab);

  if (!connected) {
    return (
      <Card>
        <TabGroup tabs={TABS} activeTab={activeTab} onChange={(id) => setActiveTab(id as TabId)} />
        <div style={{ marginTop: 'var(--space-xl)', textAlign: 'center', padding: 'var(--space-2xl) 0' }}>
          <p style={{ color: 'var(--text-muted)', fontSize: 'var(--text-sm)' }}>
            Connect your wallet to stake, unstake, claim, or compound.
          </p>
        </div>
      </Card>
    );
  }

  return (
    <Card>
      <TabGroup
        tabs={TABS}
        activeTab={activeTab}
        onChange={(id) => setActiveTab(id as TabId)}
      />

      <div style={{ marginTop: 'var(--space-xl)', minHeight: 200 }}>
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, x: slideDirection > 1 ? 20 : -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: slideDirection > 1 ? -20 : 20 }}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
          >
            {activeTab === 'stake' && (
              <StakePanel amount={amount} setAmount={setAmount} onSubmit={approvalState === 'ready' ? handleStake : handleApprove} busy={busy || approvalState === 'waiting'} lpBalance={balances.lpBalance} apy={stats.apy} approvalState={approvalState} />
            )}
            {activeTab === 'unstake' && (
              <UnstakePanel amount={amount} setAmount={setAmount} onSubmit={handleUnstake} busy={busy} stakedLp={position.stakedLp} cooldownRemaining={position.cooldownRemaining} />
            )}
            {activeTab === 'claim' && <ClaimPanel onSubmit={handleClaim} busy={busy} rewards={rewards} />}
            {activeTab === 'compound' && <CompoundPanel anchorAmount={compoundAmount} motoAmount={compoundMoto} onAnchorChange={handleCompoundAnchorChange} onMotoChange={handleCompoundMotoChange} onSubmit={handleCompound} busy={busy} maxAnchor={rewards.totalClaimable} motoBalance={bigintToNumber(dex.motoBalance)} />}
            {activeTab === 'buy' && (
              <BuyPanel amount={buyAmount} onChange={handleBuyInputChange} onSubmit={handleBuy} busy={dex.busy} motoBalance={bigintToNumber(dex.motoBalance)} quote={dex.buyQuote} />
            )}
            {activeTab === 'sell' && (
              <SellPanel amount={sellAmount} onChange={handleSellInputChange} onSubmit={handleSell} busy={dex.busy} tokenBalance={bigintToNumber(dex.tokenBalance)} quote={dex.sellQuote} />
            )}
            {activeTab === 'lp' && (
              <LpPanel tokenAmount={lpTokenAmount} motoAmount={lpMotoAmount} onTokenChange={handleLpTokenChange} onMotoChange={handleLpMotoChange} onSubmit={handleAddLiquidity} busy={dex.busy} tokenBalance={bigintToNumber(dex.tokenBalance)} motoBalance={bigintToNumber(dex.motoBalance)} />
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </Card>
  );
}

function InputField({
  value,
  onChange,
  max,
  label,
  unit = 'LP',
}: {
  value: string;
  onChange: (v: string) => void;
  max: number;
  label: string;
  unit?: string;
}) {
  return (
    <div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          fontSize: 'var(--text-sm)',
          marginBottom: 'var(--space-sm)',
        }}
      >
        <span style={{ color: 'var(--text-secondary)' }}>{label}</span>
        <span style={{ color: 'var(--text-muted)' }}>
          Balance: {formatNumber(max)} {unit}
        </span>
      </div>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          background: 'var(--surface-raised)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-md)',
          padding: '12px 16px',
          gap: 'var(--space-sm)',
          transition: 'border-color var(--duration-fast) var(--ease-out)',
        }}
        onFocus={(e) => {
          (e.currentTarget as HTMLElement).style.borderColor = 'var(--accent)';
        }}
        onBlur={(e) => {
          (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-subtle)';
        }}
      >
        <input
          type="number"
          placeholder="0.00"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          style={{
            flex: 1,
            fontFamily: 'var(--font-display)',
            fontSize: 'var(--text-xl)',
            fontWeight: 600,
            color: 'var(--text-primary)',
            background: 'none',
            border: 'none',
            outline: 'none',
            minWidth: 0,
          }}
        />
        <button
          onClick={() => onChange(max.toString())}
          style={{
            padding: '4px 10px',
            fontSize: 'var(--text-xs)',
            fontFamily: 'var(--font-display)',
            fontWeight: 700,
            color: 'var(--accent)',
            background: 'var(--accent-muted)',
            border: '1px solid var(--border-accent)',
            borderRadius: 'var(--radius-sm)',
            cursor: 'pointer',
            transition: 'background var(--duration-fast) var(--ease-out)',
          }}
        >
          MAX
        </button>
      </div>
    </div>
  );
}

function StakePanel({
  amount,
  setAmount,
  onSubmit,
  busy,
  lpBalance,
  apy,
  approvalState,
}: {
  amount: string;
  setAmount: (v: string) => void;
  onSubmit: () => void;
  busy: boolean;
  lpBalance: number;
  apy: number;
  approvalState: 'approve' | 'waiting' | 'ready';
}) {
  const buttonLabel =
    approvalState === 'waiting' ? 'Waiting for Confirmation...'
    : approvalState === 'approve' ? 'Approve LP Tokens'
    : 'Stake LP Tokens';

  return (
    <div style={{ display: 'grid', gap: 'var(--space-xl)' }}>
      <InputField value={amount} onChange={setAmount} max={lpBalance} label="Stake Amount" />
      <div
        style={{
          padding: 'var(--space-md)',
          background: 'var(--surface-raised)',
          borderRadius: 'var(--radius-md)',
          fontSize: 'var(--text-sm)',
          color: 'var(--text-secondary)',
          display: 'grid',
          gap: 'var(--space-sm)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span>Estimated APY</span>
          <span style={{ color: 'var(--color-success)', fontWeight: 600 }}>{apy.toFixed(1)}%</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span>Time Multiplier Start</span>
          <span style={{ color: 'var(--text-primary)' }}>0% (builds over ~10 days)</span>
        </div>
      </div>
      {approvalState === 'approve' && (
        <div
          style={{
            padding: 'var(--space-md)',
            background: 'rgba(234, 179, 8, 0.06)',
            border: '1px solid rgba(234, 179, 8, 0.2)',
            borderRadius: 'var(--radius-md)',
            fontSize: 'var(--text-xs)',
            color: 'var(--color-warning)',
          }}
        >
          Step 1: Approve LP tokens for the staker contract.
        </div>
      )}
      {approvalState === 'waiting' && (
        <div
          style={{
            padding: 'var(--space-md)',
            background: 'rgba(59, 130, 246, 0.06)',
            border: '1px solid rgba(59, 130, 246, 0.2)',
            borderRadius: 'var(--radius-md)',
            fontSize: 'var(--text-xs)',
            color: 'rgb(96, 165, 250)',
          }}
        >
          Approval TX sent. Waiting for on-chain confirmation (~5 min). The button will unlock automatically.
        </div>
      )}
      <Button fullWidth size="lg" disabled={busy || approvalState === 'waiting' || !amount || Number(amount) <= 0} onClick={onSubmit}>
        {buttonLabel}
      </Button>
    </div>
  );
}

function UnstakePanel({
  amount,
  setAmount,
  onSubmit,
  busy,
  stakedLp,
  cooldownRemaining,
}: {
  amount: string;
  setAmount: (v: string) => void;
  onSubmit: () => void;
  busy: boolean;
  stakedLp: number;
  cooldownRemaining: number;
}) {
  const cooldownActive = cooldownRemaining > 0;

  return (
    <div style={{ display: 'grid', gap: 'var(--space-xl)' }}>
      {cooldownActive && (
        <div
          style={{
            padding: 'var(--space-md)',
            background: 'rgba(234, 179, 8, 0.06)',
            border: '1px solid rgba(234, 179, 8, 0.2)',
            borderRadius: 'var(--radius-md)',
            fontSize: 'var(--text-sm)',
            color: 'var(--color-warning)',
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-sm)',
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10"/>
            <polyline points="12 6 12 12 16 14"/>
          </svg>
          Cooldown active. Unstaking available in ~{cooldownRemaining} blocks.
        </div>
      )}
      <InputField value={amount} onChange={setAmount} max={stakedLp} label="Unstake Amount" />
      <Button fullWidth size="lg" disabled={busy || cooldownActive || !amount || Number(amount) <= 0} onClick={onSubmit}>
        {busy ? 'Submitting...' : cooldownActive ? 'Cooldown Active' : 'Unstake LP Tokens'}
      </Button>
    </div>
  );
}

function ClaimPanel({ onSubmit, busy, rewards }: { onSubmit: () => void; busy: boolean; rewards: { baseEmission: number; sellPressureBonus: number; boostMultiplier: number; timeMultiplier: number; devFee: number; totalClaimable: number } }) {
  return (
    <div style={{ display: 'grid', gap: 'var(--space-xl)' }}>
      <div
        style={{
          padding: 'var(--space-lg)',
          background: 'var(--surface-raised)',
          borderRadius: 'var(--radius-md)',
          display: 'grid',
          gap: 'var(--space-md)',
          fontSize: 'var(--text-sm)',
        }}
      >
        <Row label="Base Emission" value={`${formatNumber(rewards.baseEmission)} ANCHOR`} />
        <Row label="Sell-Pressure Bonus" value={`${formatNumber(rewards.sellPressureBonus)} ANCHOR`} />
        <Row label={`${(rewards.boostMultiplier * 100).toFixed(0)}% Staker Boost`} value={`x${rewards.boostMultiplier.toFixed(1)}`} />
        <Row label="Time Multiplier" value={`${(rewards.timeMultiplier * 100).toFixed(1)}%`} />
        <Row label="Dev Fee (10%)" value={`-${formatNumber(rewards.devFee)} ANCHOR`} muted />
        <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: 'var(--space-md)' }}>
          <Row label="Total Claimable" value={`${formatNumber(rewards.totalClaimable)} ANCHOR`} accent />
        </div>
      </div>
      <div
        style={{
          padding: 'var(--space-md)',
          background: 'rgba(239, 68, 68, 0.06)',
          border: '1px solid rgba(239, 68, 68, 0.15)',
          borderRadius: 'var(--radius-md)',
          fontSize: 'var(--text-xs)',
          color: 'var(--text-secondary)',
        }}
      >
        Claiming resets your time multiplier to 0%. Consider compounding instead to preserve your progress.
      </div>
      <Button fullWidth size="lg" disabled={busy || rewards.totalClaimable <= 0} onClick={onSubmit}>
        {busy ? 'Submitting...' : `Claim ${formatNumber(rewards.totalClaimable)} ANCHOR`}
      </Button>
    </div>
  );
}

function CompoundPanel({ anchorAmount, motoAmount, onAnchorChange, onMotoChange, onSubmit, busy, maxAnchor, motoBalance }: {
  anchorAmount: string; motoAmount: string; onAnchorChange: (v: string) => void; onMotoChange: (v: string) => void;
  onSubmit: () => void; busy: boolean; maxAnchor: number; motoBalance: number;
}) {
  const anchorVal = parseFloat(anchorAmount) || 0;
  const motoVal = parseFloat(motoAmount) || 0;
  const canSubmit = anchorVal > 0 && motoVal > 0 && anchorVal <= maxAnchor && motoVal <= motoBalance;
  return (
    <div style={{ display: 'grid', gap: 'var(--space-xl)' }}>
      <InputField value={anchorAmount} onChange={onAnchorChange} max={maxAnchor} label="ANCHOR to compound" unit="ANCHOR" />
      <InputField value={motoAmount} onChange={onMotoChange} max={motoBalance} label="MOTO needed for LP" unit="MOTO" />
      <div
        style={{
          padding: 'var(--space-lg)',
          background: 'var(--surface-raised)',
          borderRadius: 'var(--radius-md)',
          display: 'grid',
          gap: 'var(--space-md)',
          fontSize: 'var(--text-sm)',
        }}
      >
        <Row label="ANCHOR from rewards" value={`${formatNumber(anchorVal)} ANCHOR`} />
        <Row label="MOTO from wallet" value={`${formatNumber(motoVal)} MOTO`} />
        <Row label="Available MOTO" value={`${formatNumber(motoBalance)} MOTO`} />
        <Row label="Time Multiplier" value="Preserved" accent />
      </div>
      <div
        style={{
          padding: 'var(--space-md)',
          background: 'rgba(34, 197, 94, 0.06)',
          border: '1px solid rgba(34, 197, 94, 0.15)',
          borderRadius: 'var(--radius-md)',
          fontSize: 'var(--text-xs)',
          color: 'var(--color-success)',
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--space-sm)',
        }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polyline points="20 6 9 17 4 12"/>
        </svg>
        Compounding preserves your time multiplier — unlike claiming which resets it.
      </div>
      <Button fullWidth size="lg" disabled={busy || !canSubmit} onClick={onSubmit}>
        {busy ? 'Submitting...' : `Compound ${formatNumber(anchorVal)} ANCHOR into LP`}
      </Button>
    </div>
  );
}

function BuyPanel({
  amount, onChange, onSubmit, busy, motoBalance, quote,
}: {
  amount: string; onChange: (v: string) => void; onSubmit: () => void; busy: boolean; motoBalance: number; quote: bigint;
}) {
  return (
    <div style={{ display: 'grid', gap: 'var(--space-xl)' }}>
      <InputField value={amount} onChange={onChange} max={motoBalance} label="MOTO to spend" unit="MOTO" />
      {quote > 0n && (
        <div style={quoteBoxStyle}>
          <span style={{ color: 'var(--text-secondary)' }}>You receive (est.)</span>
          <span style={{ fontFamily: 'var(--font-display)', fontWeight: 600, color: 'var(--text-accent)' }}>
            {formatNumber(bigintToNumber(quote))} ANCHOR
          </span>
        </div>
      )}
      <Button fullWidth size="lg" disabled={busy || !amount || Number(amount) <= 0} onClick={onSubmit}>
        {busy ? 'Swapping...' : 'Buy ANCHOR'}
      </Button>
      <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', textAlign: 'center' }}>
        Swaps MOTO for ANCHOR via MotoSwap.
      </div>
    </div>
  );
}

function SellPanel({
  amount, onChange, onSubmit, busy, tokenBalance, quote,
}: {
  amount: string; onChange: (v: string) => void; onSubmit: () => void; busy: boolean; tokenBalance: number; quote: bigint;
}) {
  return (
    <div style={{ display: 'grid', gap: 'var(--space-xl)' }}>
      <InputField value={amount} onChange={onChange} max={tokenBalance} label="ANCHOR to sell" unit="ANCHOR" />
      {quote > 0n && (
        <div style={quoteBoxStyle}>
          <span style={{ color: 'var(--text-secondary)' }}>You receive (est.)</span>
          <span style={{ fontFamily: 'var(--font-display)', fontWeight: 600, color: 'var(--text-accent)' }}>
            {formatNumber(bigintToNumber(quote))} MOTO
          </span>
        </div>
      )}
      <Button fullWidth size="lg" disabled={busy || !amount || Number(amount) <= 0} onClick={onSubmit}>
        {busy ? 'Swapping...' : 'Sell ANCHOR'}
      </Button>
      <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', textAlign: 'center' }}>
        Swaps ANCHOR for MOTO via MotoSwap.
      </div>
    </div>
  );
}

function LpPanel({
  tokenAmount, motoAmount, onTokenChange, onMotoChange, onSubmit, busy, tokenBalance, motoBalance,
}: {
  tokenAmount: string; motoAmount: string; onTokenChange: (v: string) => void; onMotoChange: (v: string) => void;
  onSubmit: () => void; busy: boolean; tokenBalance: number; motoBalance: number;
}) {
  return (
    <div style={{ display: 'grid', gap: 'var(--space-xl)' }}>
      <InputField value={tokenAmount} onChange={onTokenChange} max={tokenBalance} label="ANCHOR amount" unit="ANCHOR" />
      <InputField value={motoAmount} onChange={onMotoChange} max={motoBalance} label="MOTO amount" unit="MOTO" />
      <Button fullWidth size="lg" disabled={busy || !tokenAmount || Number(tokenAmount) <= 0 || !motoAmount || Number(motoAmount) <= 0} onClick={onSubmit}>
        {busy ? 'Adding Liquidity...' : 'Add Liquidity'}
      </Button>
      <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', textAlign: 'center' }}>
        Adds ANCHOR + MOTO liquidity to MotoSwap. You receive LP tokens.
      </div>
    </div>
  );
}

const quoteBoxStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: 'var(--space-md)',
  background: 'var(--surface-raised)',
  borderRadius: 'var(--radius-md)',
  border: '1px solid var(--border-accent)',
  fontSize: 'var(--text-sm)',
};

function Row({
  label,
  value,
  accent = false,
  muted = false,
}: {
  label: string;
  value: string;
  accent?: boolean;
  muted?: boolean;
}) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <span style={{ color: muted ? 'var(--text-muted)' : 'var(--text-secondary)' }}>{label}</span>
      <span
        style={{
          fontFamily: 'var(--font-display)',
          fontWeight: 600,
          color: accent ? 'var(--text-accent)' : muted ? 'var(--text-muted)' : 'var(--text-primary)',
        }}
      >
        {value}
      </span>
    </div>
  );
}
