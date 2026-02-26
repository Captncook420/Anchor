import { Card } from '../common/Card';
import { ProgressBar } from '../common/ProgressBar';
import { useStakingPosition } from '../../hooks/useStakingPosition';
import { useWallet } from '../../hooks/useWallet';
import { formatNumber, formatBlocks } from '../../utils/format';
import { MULTIPLIER_BLOCKS, COOLDOWN_BLOCKS } from '../../utils/constants';

export function PositionCard() {
  const { position: pos, loading } = useStakingPosition();
  const { connected } = useWallet();
  const totalRewards = pos.pendingBaseRewards + pos.pendingSellPressureRewards;
  const cooldownActive = pos.cooldownRemaining > 0;

  if (!connected) {
    return (
      <Card glow>
        <h2
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 'var(--text-2xl)',
            fontWeight: 700,
            color: 'var(--text-primary)',
            marginBottom: 'var(--space-md)',
          }}
        >
          Your Position
        </h2>
        <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>
          Connect your wallet to view your staking position.
        </p>
      </Card>
    );
  }

  if (loading) {
    return <Card glow><div style={{ minHeight: 200 }} /></Card>;
  }

  return (
    <Card glow>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 'var(--space-xl)',
          flexWrap: 'wrap',
          gap: 'var(--space-md)',
        }}
      >
        <div>
          <h2
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 'var(--text-2xl)',
              fontWeight: 700,
              color: 'var(--text-primary)',
            }}
          >
            Your Position
          </h2>
          <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)', marginTop: 2 }}>
            ANCHOR/MOTO LP Staking
          </p>
        </div>
        {cooldownActive && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--space-sm)',
              padding: '6px 14px',
              background: 'rgba(234, 179, 8, 0.1)',
              border: '1px solid rgba(234, 179, 8, 0.25)',
              borderRadius: 'var(--radius-full)',
              fontSize: 'var(--text-xs)',
              fontWeight: 600,
              color: 'var(--color-warning)',
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
            Cooldown: {formatBlocks(pos.cooldownRemaining)}
          </div>
        )}
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
          gap: 'var(--space-lg)',
          marginBottom: 'var(--space-xl)',
        }}
      >
        <StatItem label="Staked LP" value={formatNumber(pos.stakedLp)} />
        <StatItem label="Pending Rewards" value={formatNumber(totalRewards)} suffix=" ANCHOR" accent />
        <StatItem label="Base Rewards" value={formatNumber(pos.pendingBaseRewards)} />
        <StatItem label="Sell-Pressure Bonus" value={formatNumber(pos.pendingSellPressureRewards)} />
      </div>

      <div style={{ display: 'grid', gap: 'var(--space-lg)' }}>
        <ProgressBar
          value={pos.timeMultiplier}
          max={100}
          label="Time Multiplier"
          showPercent
          height={10}
        />
        {cooldownActive && (
          <ProgressBar
            value={COOLDOWN_BLOCKS - pos.cooldownRemaining}
            max={COOLDOWN_BLOCKS}
            label={`Unstake Cooldown (${formatBlocks(pos.cooldownRemaining)} remaining)`}
            showPercent={false}
            height={6}
            accentColor="linear-gradient(90deg, var(--color-warning) 0%, #d4a000 100%)"
          />
        )}
        <div
          style={{
            display: 'flex',
            gap: 'var(--space-lg)',
            fontSize: 'var(--text-xs)',
            color: 'var(--text-muted)',
            flexWrap: 'wrap',
          }}
        >
          <span>Block {pos.currentBlock.toLocaleString()}</span>
          <span>Multiplier reaches 100% in {formatBlocks(MULTIPLIER_BLOCKS - Math.floor(MULTIPLIER_BLOCKS * pos.timeMultiplier / 100))}</span>
        </div>
      </div>
    </Card>
  );
}

function StatItem({
  label,
  value,
  suffix = '',
  accent = false,
}: {
  label: string;
  value: string;
  suffix?: string;
  accent?: boolean;
}) {
  return (
    <div>
      <div
        style={{
          fontSize: 'var(--text-xs)',
          color: 'var(--text-muted)',
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
          marginBottom: 'var(--space-xs)',
          fontWeight: 500,
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontFamily: 'var(--font-display)',
          fontSize: 'var(--text-xl)',
          fontWeight: 700,
          color: accent ? 'var(--text-accent)' : 'var(--text-primary)',
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {value}
        {suffix && (
          <span style={{ fontSize: 'var(--text-sm)', fontWeight: 500, opacity: 0.6 }}>
            {suffix}
          </span>
        )}
      </div>
    </div>
  );
}
