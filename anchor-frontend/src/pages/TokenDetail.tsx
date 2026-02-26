import { useState, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { PageTransition } from '../components/Layout/PageTransition';
import { Card } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { ProgressBar } from '../components/common/ProgressBar';
import { useToast } from '../components/common/Toast';
import { useChildTokens } from '../hooks/useChildTokens';
import { useChildStaking } from '../hooks/useChildStaking';
import { useDexActions } from '../hooks/useDexActions';
import { formatNumber, formatPercent, formatAddress } from '../utils/format';
import { numberToBigint, bigintToNumber } from '../utils/bigint';

export function TokenDetail() {
  const { address } = useParams<{ address: string }>();
  const navigate = useNavigate();
  const { addToast } = useToast();
  const { tokens, loading } = useChildTokens();

  const token = tokens.find((t) => t.address === address);

  const {
    position,
    loading: stakingLoading,
    actionPending,
    connected,
    approvalState,
    approveLp,
    stake,
    unstake,
    claim,
    compound,
  } = useChildStaking(token?.address ?? '', token?.stakerAddress ?? '');

  const dex = useDexActions(token?.address ?? '');

  const [stakeInput, setStakeInput] = useState('');
  const [unstakeInput, setUnstakeInput] = useState('');
  const [compoundInput, setCompoundInput] = useState('');
  const [activeTab, setActiveTab] = useState<'stake' | 'unstake'>('stake');
  const [dexTab, setDexTab] = useState<'buy' | 'sell' | 'lp'>('buy');
  const [buyInput, setBuyInput] = useState('');
  const [sellInput, setSellInput] = useState('');
  const [lpTokenInput, setLpTokenInput] = useState('');
  const [lpMotoInput, setLpMotoInput] = useState('');
  const buyQuoteTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sellQuoteTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleApprove = useCallback(async () => {
    try {
      await approveLp();
      addToast({ type: 'info', title: 'Approval Sent', message: 'Waiting for on-chain confirmation (~5 min). Button will unlock automatically.' });
    } catch (err: unknown) {
      addToast({ type: 'error', title: 'Approval Failed', message: err instanceof Error ? err.message : String(err) });
    }
  }, [approveLp, addToast]);

  const handleStake = useCallback(async () => {
    const val = parseFloat(stakeInput);
    if (!val || val <= 0) return;
    try {
      const amount = numberToBigint(val);
      await stake(amount);
      addToast({ type: 'success', title: 'Staked', message: `Staked ${val.toLocaleString()} LP tokens` });
      setStakeInput('');
    } catch (err: unknown) {
      addToast({ type: 'error', title: 'Stake Failed', message: err instanceof Error ? err.message : String(err) });
    }
  }, [stakeInput, stake, addToast]);

  const handleUnstake = useCallback(async () => {
    const val = parseFloat(unstakeInput);
    if (!val || val <= 0) return;
    try {
      const amount = numberToBigint(val);
      await unstake(amount);
      addToast({ type: 'success', title: 'Unstaked', message: `Unstaked ${val.toLocaleString()} LP tokens` });
      setUnstakeInput('');
    } catch (err: unknown) {
      addToast({ type: 'error', title: 'Unstake Failed', message: err instanceof Error ? err.message : String(err) });
    }
  }, [unstakeInput, unstake, addToast]);

  const handleClaim = useCallback(async () => {
    try {
      await claim();
      addToast({ type: 'success', title: 'Claimed', message: 'Rewards claimed to your wallet' });
    } catch (err: unknown) {
      addToast({ type: 'error', title: 'Claim Failed', message: err instanceof Error ? err.message : String(err) });
    }
  }, [claim, addToast]);

  const handleCompound = useCallback(async () => {
    const val = parseFloat(compoundInput);
    if (!val || val <= 0) return;
    try {
      const amount = numberToBigint(val);
      await compound(amount);
      addToast({ type: 'success', title: 'Compounded', message: `${val.toLocaleString()} ${token?.symbol ?? ''} rewards minted (multiplier preserved)` });
      setCompoundInput('');
    } catch (err: unknown) {
      addToast({ type: 'error', title: 'Compound Failed', message: err instanceof Error ? err.message : String(err) });
    }
  }, [compound, compoundInput, token?.symbol, addToast]);

  // ── DEX handlers ──

  const handleBuyInputChange = useCallback((val: string) => {
    setBuyInput(val);
    if (buyQuoteTimer.current) clearTimeout(buyQuoteTimer.current);
    const num = parseFloat(val);
    if (!num || num <= 0) { void dex.getBuyQuote(0n); return; }
    buyQuoteTimer.current = setTimeout(() => void dex.getBuyQuote(numberToBigint(num)), 400);
  }, [dex.getBuyQuote]);

  const handleSellInputChange = useCallback((val: string) => {
    setSellInput(val);
    if (sellQuoteTimer.current) clearTimeout(sellQuoteTimer.current);
    const num = parseFloat(val);
    if (!num || num <= 0) { void dex.getSellQuote(0n); return; }
    sellQuoteTimer.current = setTimeout(() => void dex.getSellQuote(numberToBigint(num)), 400);
  }, [dex.getSellQuote]);

  const handleBuy = useCallback(async () => {
    const val = parseFloat(buyInput);
    if (!val || val <= 0) return;
    try {
      const txId = await dex.buy(numberToBigint(val));
      addToast({ type: 'success', title: 'Buy Successful', message: `Bought ${token?.symbol ?? ''} with ${val.toLocaleString()} MOTO. TX: ${txId.slice(0, 12)}...` });
      setBuyInput('');
    } catch (err: unknown) {
      addToast({ type: 'error', title: 'Buy Failed', message: err instanceof Error ? err.message : String(err) });
    }
  }, [buyInput, dex.buy, addToast, token?.symbol]);

  const handleSell = useCallback(async () => {
    const val = parseFloat(sellInput);
    if (!val || val <= 0) return;
    try {
      const txId = await dex.sell(numberToBigint(val));
      addToast({ type: 'success', title: 'Sell Successful', message: `Sold ${val.toLocaleString()} ${token?.symbol ?? ''} for MOTO. TX: ${txId.slice(0, 12)}...` });
      setSellInput('');
    } catch (err: unknown) {
      addToast({ type: 'error', title: 'Sell Failed', message: err instanceof Error ? err.message : String(err) });
    }
  }, [sellInput, dex.sell, addToast, token?.symbol]);

  // LP auto-calculation: typing one side auto-fills the other
  const handleLpTokenChange = useCallback((val: string) => {
    setLpTokenInput(val);
    const num = parseFloat(val);
    if (!num || num <= 0) { setLpMotoInput(''); return; }
    const matched = dex.getMatchingAmount(numberToBigint(num), true);
    if (matched > 0n) setLpMotoInput(bigintToNumber(matched).toString());
  }, [dex.getMatchingAmount]);

  const handleLpMotoChange = useCallback((val: string) => {
    setLpMotoInput(val);
    const num = parseFloat(val);
    if (!num || num <= 0) { setLpTokenInput(''); return; }
    const matched = dex.getMatchingAmount(numberToBigint(num), false);
    if (matched > 0n) setLpTokenInput(bigintToNumber(matched).toString());
  }, [dex.getMatchingAmount]);

  const handleAddLiquidity = useCallback(async () => {
    const tokenVal = parseFloat(lpTokenInput);
    const motoVal = parseFloat(lpMotoInput);
    if (!tokenVal || tokenVal <= 0 || !motoVal || motoVal <= 0) return;
    try {
      const txId = await dex.addLiquidity(numberToBigint(tokenVal), numberToBigint(motoVal));
      addToast({ type: 'success', title: 'Liquidity Added', message: `Added ${tokenVal.toLocaleString()} ${token?.symbol ?? ''} + ${motoVal.toLocaleString()} MOTO. TX: ${txId.slice(0, 12)}...` });
      setLpTokenInput('');
      setLpMotoInput('');
    } catch (err: unknown) {
      addToast({ type: 'error', title: 'Add LP Failed', message: err instanceof Error ? err.message : String(err) });
    }
  }, [lpTokenInput, lpMotoInput, dex.addLiquidity, addToast, token?.symbol]);

  const motoBalanceDisplay = bigintToNumber(dex.motoBalance);
  const tokenBalanceDisplay = bigintToNumber(dex.tokenBalance);

  if (loading) {
    return (
      <PageTransition>
        <div style={{ padding: 'var(--space-2xl)', textAlign: 'center', color: 'var(--text-muted)' }}>
          Loading token data...
        </div>
      </PageTransition>
    );
  }

  if (!token) {
    return (
      <PageTransition>
        <BackButton onClick={() => navigate('/factory')} />
        <div style={{ padding: 'var(--space-2xl)', textAlign: 'center', color: 'var(--text-muted)' }}>
          Token not found.
        </div>
      </PageTransition>
    );
  }

  const multiplierPercent = position.multiplierBps / 100;
  const apy = position.totalStaked > 0
    ? (position.rewardPerBlock * 52_560 / position.totalStaked) * 100
    : 0;

  return (
    <PageTransition>
      <BackButton onClick={() => navigate('/factory')} />

      {/* Token header */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--space-lg)',
          marginBottom: 'var(--space-2xl)',
          flexWrap: 'wrap',
        }}
      >
        <div style={tokenIconStyle}>{token.symbol.charAt(0)}</div>
        <div>
          <h1 style={titleStyle}>{token.name}</h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-md)', marginTop: 4 }}>
            <span style={{ color: 'var(--text-muted)', fontSize: 'var(--text-sm)' }}>${token.symbol}</span>
            <span style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 'var(--text-lg)', color: 'var(--text-primary)' }}>
              Supply: {formatNumber(token.totalSupply)}
            </span>
          </div>
        </div>
      </motion.div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 'var(--space-xl)' }}>

        {/* Your Position */}
        <Card delay={0.05}>
          <h3 style={sectionTitle}>Your Position</h3>
          {!connected ? (
            <div style={{ color: 'var(--text-muted)', fontSize: 'var(--text-sm)', padding: 'var(--space-lg) 0' }}>
              Connect wallet to view your position
            </div>
          ) : stakingLoading ? (
            <div style={{ color: 'var(--text-muted)', fontSize: 'var(--text-sm)', padding: 'var(--space-lg) 0' }}>
              Loading position...
            </div>
          ) : (
            <div style={{ display: 'grid', gap: 'var(--space-md)', fontSize: 'var(--text-sm)' }}>
              <Row label="LP Balance (wallet)" value={formatNumber(position.lpBalance)} />
              <Row label="Staked LP" value={formatNumber(position.stakedLp)} accent />
              <Row label="Pending Rewards" value={`${formatNumber(position.pendingReward)} ${token.symbol}`} accent />
              <Row label="Time Multiplier" value={`${multiplierPercent.toFixed(1)}%`} />
              {position.cooldownBlocks > 0 && (
                <Row label="Cooldown" value={`${position.cooldownBlocks} blocks`} />
              )}

              {/* Claim / Compound */}
              {position.stakedLp > 0 && (
                <div style={{ display: 'grid', gap: 'var(--space-sm)', marginTop: 'var(--space-sm)' }}>
                  <Button
                    size="sm"
                    fullWidth
                    disabled={actionPending || position.pendingReward === 0}
                    onClick={handleClaim}
                  >
                    {actionPending ? '...' : 'Claim All (resets multiplier)'}
                  </Button>

                  <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginTop: 'var(--space-xs)' }}>
                    Compound mints rewards without resetting your multiplier:
                  </div>
                  <AmountInput
                    value={compoundInput}
                    onChange={setCompoundInput}
                    max={position.pendingReward}
                    onMax={() => setCompoundInput(position.pendingReward > 0 ? String(position.pendingReward) : '')}
                    label={token.symbol}
                  />
                  <Button
                    size="sm"
                    fullWidth
                    disabled={actionPending || !compoundInput || parseFloat(compoundInput) <= 0}
                    onClick={handleCompound}
                  >
                    {actionPending ? '...' : 'Compound'}
                  </Button>
                </div>
              )}
            </div>
          )}
        </Card>

        {/* Stake / Unstake */}
        <Card glow delay={0.1}>
          {/* Tab switcher */}
          <div style={{ display: 'flex', gap: 2, marginBottom: 'var(--space-lg)' }}>
            <TabButton active={activeTab === 'stake'} onClick={() => setActiveTab('stake')}>Stake</TabButton>
            <TabButton active={activeTab === 'unstake'} onClick={() => setActiveTab('unstake')}>Unstake</TabButton>
          </div>

          {activeTab === 'stake' ? (
            <div style={{ display: 'grid', gap: 'var(--space-md)' }}>
              <AmountInput
                value={stakeInput}
                onChange={setStakeInput}
                max={position.lpBalance}
                onMax={() => setStakeInput(position.lpBalance > 0 ? String(position.lpBalance) : '')}
                label="LP"
              />
              <ProgressBar value={Math.min(multiplierPercent, 100)} label="Time Multiplier" height={8} />
              {approvalState === 'approve' && (
                <div style={{ padding: 'var(--space-sm) var(--space-md)', background: 'rgba(234, 179, 8, 0.06)', border: '1px solid rgba(234, 179, 8, 0.2)', borderRadius: 'var(--radius-md)', fontSize: 'var(--text-xs)', color: 'var(--color-warning)' }}>
                  Step 1: Approve LP tokens for the staker contract.
                </div>
              )}
              {approvalState === 'waiting' && (
                <div style={{ padding: 'var(--space-sm) var(--space-md)', background: 'rgba(59, 130, 246, 0.06)', border: '1px solid rgba(59, 130, 246, 0.2)', borderRadius: 'var(--radius-md)', fontSize: 'var(--text-xs)', color: 'rgb(96, 165, 250)' }}>
                  Approval TX sent. Waiting for on-chain confirmation (~5 min). Button will unlock automatically.
                </div>
              )}
              <Button
                fullWidth
                disabled={!connected || actionPending || approvalState === 'waiting' || !stakeInput || parseFloat(stakeInput) <= 0}
                onClick={approvalState === 'ready' ? handleStake : handleApprove}
              >
                {approvalState === 'waiting' ? 'Waiting for Confirmation...' : approvalState === 'approve' ? 'Approve LP Tokens' : actionPending ? 'Processing...' : !connected ? 'Connect Wallet' : 'Stake LP'}
              </Button>
            </div>
          ) : (
            <div style={{ display: 'grid', gap: 'var(--space-md)' }}>
              <AmountInput
                value={unstakeInput}
                onChange={setUnstakeInput}
                max={position.stakedLp}
                onMax={() => setUnstakeInput(position.stakedLp > 0 ? String(position.stakedLp) : '')}
                label="LP"
              />
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                Unstaking resets your time multiplier.
              </div>
              <Button
                fullWidth
                disabled={!connected || actionPending || !unstakeInput || parseFloat(unstakeInput) <= 0}
                onClick={handleUnstake}
              >
                {actionPending ? 'Processing...' : 'Unstake LP'}
              </Button>
            </div>
          )}
        </Card>

        {/* Buy / Sell / LP */}
        <Card delay={0.15}>
          <div style={{ display: 'flex', gap: 2, marginBottom: 'var(--space-lg)' }}>
            <TabButton active={dexTab === 'buy'} onClick={() => setDexTab('buy')}>Buy</TabButton>
            <TabButton active={dexTab === 'sell'} onClick={() => setDexTab('sell')}>Sell</TabButton>
            <TabButton active={dexTab === 'lp'} onClick={() => setDexTab('lp')}>LP</TabButton>
          </div>

          {!dex.connected ? (
            <div style={{ color: 'var(--text-muted)', fontSize: 'var(--text-sm)', padding: 'var(--space-lg) 0' }}>
              Connect wallet to trade
            </div>
          ) : dex.loading ? (
            <div style={{ color: 'var(--text-muted)', fontSize: 'var(--text-sm)', padding: 'var(--space-lg) 0' }}>
              Loading balances...
            </div>
          ) : (
            <>
              {dexTab === 'buy' && (
                <div style={{ display: 'grid', gap: 'var(--space-md)' }}>
                  <AmountInput
                    value={buyInput}
                    onChange={handleBuyInputChange}
                    max={motoBalanceDisplay}
                    onMax={() => handleBuyInputChange(motoBalanceDisplay > 0 ? String(motoBalanceDisplay) : '')}
                    label="MOTO"
                  />
                  {dex.buyQuote > 0n && (
                    <div style={quoteBoxStyle}>
                      <span style={{ color: 'var(--text-muted)', fontSize: 'var(--text-xs)' }}>You receive (est.)</span>
                      <span style={{ fontFamily: 'var(--font-display)', fontWeight: 600, color: 'var(--text-accent)', fontSize: 'var(--text-lg)' }}>
                        {formatNumber(bigintToNumber(dex.buyQuote))} {token.symbol}
                      </span>
                    </div>
                  )}
                  <Button fullWidth disabled={dex.busy || !buyInput || parseFloat(buyInput) <= 0} onClick={handleBuy}>
                    {dex.busy ? 'Swapping...' : `Buy ${token.symbol}`}
                  </Button>
                </div>
              )}

              {dexTab === 'sell' && (
                <div style={{ display: 'grid', gap: 'var(--space-md)' }}>
                  <AmountInput
                    value={sellInput}
                    onChange={handleSellInputChange}
                    max={tokenBalanceDisplay}
                    onMax={() => handleSellInputChange(tokenBalanceDisplay > 0 ? String(tokenBalanceDisplay) : '')}
                    label={token.symbol}
                  />
                  {dex.sellQuote > 0n && (
                    <div style={quoteBoxStyle}>
                      <span style={{ color: 'var(--text-muted)', fontSize: 'var(--text-xs)' }}>You receive (est.)</span>
                      <span style={{ fontFamily: 'var(--font-display)', fontWeight: 600, color: 'var(--text-accent)', fontSize: 'var(--text-lg)' }}>
                        {formatNumber(bigintToNumber(dex.sellQuote))} MOTO
                      </span>
                    </div>
                  )}
                  <Button fullWidth disabled={dex.busy || !sellInput || parseFloat(sellInput) <= 0} onClick={handleSell}>
                    {dex.busy ? 'Swapping...' : `Sell ${token.symbol}`}
                  </Button>
                </div>
              )}

              {dexTab === 'lp' && (
                <div style={{ display: 'grid', gap: 'var(--space-md)' }}>
                  <AmountInput
                    value={lpTokenInput}
                    onChange={handleLpTokenChange}
                    max={tokenBalanceDisplay}
                    onMax={() => handleLpTokenChange(tokenBalanceDisplay > 0 ? String(tokenBalanceDisplay) : '')}
                    label={token.symbol}
                  />
                  <AmountInput
                    value={lpMotoInput}
                    onChange={handleLpMotoChange}
                    max={motoBalanceDisplay}
                    onMax={() => handleLpMotoChange(motoBalanceDisplay > 0 ? String(motoBalanceDisplay) : '')}
                    label="MOTO"
                  />
                  <Button
                    fullWidth
                    disabled={dex.busy || !lpTokenInput || parseFloat(lpTokenInput) <= 0 || !lpMotoInput || parseFloat(lpMotoInput) <= 0}
                    onClick={handleAddLiquidity}
                  >
                    {dex.busy ? 'Adding Liquidity...' : 'Add Liquidity'}
                  </Button>
                  <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', textAlign: 'center' }}>
                    Adds {token.symbol} + MOTO liquidity to MotoSwap. You receive LP tokens.
                  </div>
                </div>
              )}
            </>
          )}
        </Card>

        {/* Pool Stats */}
        <Card delay={0.2}>
          <h3 style={sectionTitle}>Pool Statistics</h3>
          <div style={{ display: 'grid', gap: 'var(--space-md)', fontSize: 'var(--text-sm)' }}>
            <Row label="Total Staked" value={formatNumber(position.totalStaked)} />
            <Row label="Reward / Block" value={formatNumber(position.rewardPerBlock)} />
            <Row label="APY" value={formatPercent(apy)} accent />
            <Row label="Creator" value={formatAddress(token.creatorAddress)} />
            <Row label="Token" value={formatAddress(token.address)} />
            <Row label="Staker" value={formatAddress(token.stakerAddress)} />
          </div>
        </Card>

        {/* Platform fee flow */}
        <Card delay={0.25}>
          <h3 style={sectionTitle}>Platform Fee Flow</h3>
          <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', marginBottom: 'var(--space-lg)', lineHeight: 'var(--leading-relaxed)' }}>
            1% of every ${token.symbol} staking emission feeds back into ANCHOR.
          </p>
          <div style={{ display: 'grid', gap: 'var(--space-sm)' }}>
            {[
              `Mint ${token.symbol} rewards`,
              'Swap to MOTO via MotoSwap',
              'Split 50/50',
              'Swap half to ANCHOR',
              'Add ANCHOR/MOTO LP',
              'Burn LP permanently',
            ].map((step, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -12 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.3 + i * 0.06 }}
                style={stepRowStyle}
              >
                <span style={stepNumStyle}>{i + 1}</span>
                {step}
              </motion.div>
            ))}
          </div>
        </Card>
      </div>
    </PageTransition>
  );
}

/* ---- Sub-components ---- */

function BackButton({ onClick }: { onClick: () => void }) {
  return (
    <button onClick={onClick} style={backBtnStyle}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M19 12H5M12 19l-7-7 7-7"/>
      </svg>
      Back to Factory
    </button>
  );
}

function Row({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <span style={{ color: 'var(--text-muted)' }}>{label}</span>
      <span style={{ fontFamily: 'var(--font-display)', fontWeight: 600, color: accent ? 'var(--text-accent)' : 'var(--text-primary)' }}>
        {value}
      </span>
    </div>
  );
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      style={{
        flex: 1,
        padding: '8px 16px',
        fontFamily: 'var(--font-display)',
        fontWeight: 600,
        fontSize: 'var(--text-sm)',
        border: 'none',
        cursor: 'pointer',
        borderRadius: 'var(--radius-md)',
        color: active ? 'var(--accent)' : 'var(--text-muted)',
        background: active ? 'var(--accent-muted)' : 'transparent',
        transition: 'all 0.15s',
      }}
    >
      {children}
    </button>
  );
}

function AmountInput({
  value, onChange, max, onMax, label,
}: {
  value: string; onChange: (v: string) => void; max: number; onMax: () => void; label: string;
}) {
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
        <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
          Available: {formatNumber(max)}
        </span>
        <button
          onClick={onMax}
          style={{
            fontSize: 'var(--text-xs)',
            color: 'var(--accent)',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            fontWeight: 600,
            padding: 0,
          }}
        >
          MAX
        </button>
      </div>
      <div style={inputWrapStyle}>
        <input
          type="number"
          placeholder="0.00"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          style={inputStyle}
        />
        <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)', fontWeight: 500 }}>{label}</span>
      </div>
    </div>
  );
}

/* ---- Styles ---- */

const backBtnStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 'var(--space-sm)',
  color: 'var(--text-secondary)',
  fontSize: 'var(--text-sm)',
  marginBottom: 'var(--space-xl)',
  background: 'none',
  border: 'none',
  cursor: 'pointer',
  padding: 0,
};

const tokenIconStyle: React.CSSProperties = {
  width: 64,
  height: 64,
  borderRadius: 'var(--radius-xl)',
  background: 'linear-gradient(135deg, var(--accent-muted) 0%, var(--surface-interactive) 100%)',
  border: '1px solid var(--border-accent)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontFamily: 'var(--font-display)',
  fontWeight: 800,
  fontSize: 'var(--text-2xl)',
  color: 'var(--accent)',
  boxShadow: '0 4px 16px var(--accent-glow)',
};

const titleStyle: React.CSSProperties = {
  fontFamily: 'var(--font-display)',
  fontSize: 'var(--text-3xl)',
  fontWeight: 700,
  color: 'var(--text-primary)',
  lineHeight: 'var(--leading-tight)',
};

const sectionTitle: React.CSSProperties = {
  fontFamily: 'var(--font-display)',
  fontWeight: 600,
  marginBottom: 'var(--space-lg)',
  color: 'var(--text-primary)',
};

const inputWrapStyle: React.CSSProperties = {
  padding: '12px 16px',
  background: 'var(--surface-raised)',
  border: '1px solid var(--border-subtle)',
  borderRadius: 'var(--radius-md)',
  display: 'flex',
  alignItems: 'center',
};

const inputStyle: React.CSSProperties = {
  flex: 1,
  fontFamily: 'var(--font-display)',
  fontSize: 'var(--text-xl)',
  fontWeight: 600,
  color: 'var(--text-primary)',
  background: 'none',
  border: 'none',
  outline: 'none',
  minWidth: 0,
};

const quoteBoxStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: 'var(--space-sm) var(--space-md)',
  background: 'var(--surface-raised)',
  borderRadius: 'var(--radius-sm)',
  border: '1px solid var(--border-accent)',
};

const stepRowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 'var(--space-md)',
  padding: 'var(--space-sm) var(--space-md)',
  background: 'var(--surface-raised)',
  borderRadius: 'var(--radius-sm)',
  fontSize: 'var(--text-sm)',
  color: 'var(--text-secondary)',
};

const stepNumStyle: React.CSSProperties = {
  width: 20,
  height: 20,
  borderRadius: 'var(--radius-full)',
  background: 'var(--accent-muted)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: 'var(--text-xs)',
  fontWeight: 700,
  color: 'var(--accent)',
  fontFamily: 'var(--font-display)',
  flexShrink: 0,
};
