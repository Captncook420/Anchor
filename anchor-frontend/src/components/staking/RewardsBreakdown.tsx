import { motion } from 'framer-motion';
import { Card } from '../common/Card';
import { useRewardsBreakdown } from '../../hooks/useRewardsBreakdown';
import { useWallet } from '../../hooks/useWallet';
import { formatNumber } from '../../utils/format';

export function RewardsBreakdown() {
  const { rewards: r, loading } = useRewardsBreakdown();
  const { connected } = useWallet();

  if (!connected) {
    return (
      <Card delay={0.1}>
        <h3
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 'var(--text-lg)',
            fontWeight: 600,
            color: 'var(--text-primary)',
            marginBottom: 'var(--space-xl)',
          }}
        >
          Rewards Breakdown
        </h3>
        <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>
          Connect your wallet to view rewards.
        </p>
      </Card>
    );
  }

  if (loading) {
    return <Card delay={0.1}><div style={{ minHeight: 200 }} /></Card>;
  }

  const total = r.baseEmission + r.sellPressureBonus;
  const basePercent = total > 0 ? (r.baseEmission / total) * 100 : 100;
  const bonusPercent = total > 0 ? (r.sellPressureBonus / total) * 100 : 0;

  return (
    <Card delay={0.1}>
      <h3
        style={{
          fontFamily: 'var(--font-display)',
          fontSize: 'var(--text-lg)',
          fontWeight: 600,
          color: 'var(--text-primary)',
          marginBottom: 'var(--space-xl)',
        }}
      >
        Rewards Breakdown
      </h3>

      {/* Donut chart */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-xl)', marginBottom: 'var(--space-xl)' }}>
        <div style={{ width: 100, height: 100, flexShrink: 0, position: 'relative' }}>
          <svg viewBox="0 0 36 36" style={{ transform: 'rotate(-90deg)' }}>
            {/* Base track */}
            <circle cx="18" cy="18" r="14" fill="none" stroke="var(--surface-interactive)" strokeWidth="4" />
            {/* Base emission */}
            <motion.circle
              cx="18"
              cy="18"
              r="14"
              fill="none"
              stroke="#F7931A"
              strokeWidth="4"
              strokeDasharray={`${basePercent * 0.88} ${100 - basePercent * 0.88}`}
              strokeDashoffset="0"
              strokeLinecap="round"
              initial={{ strokeDasharray: '0 100' }}
              whileInView={{ strokeDasharray: `${basePercent * 0.88} ${100 - basePercent * 0.88}` }}
              viewport={{ once: true }}
              transition={{ duration: 1, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}
            />
            {/* Sell pressure bonus */}
            <motion.circle
              cx="18"
              cy="18"
              r="14"
              fill="none"
              stroke="#FFB84D"
              strokeWidth="4"
              strokeDasharray={`${bonusPercent * 0.88} ${100 - bonusPercent * 0.88}`}
              strokeDashoffset={`${-(basePercent * 0.88)}`}
              strokeLinecap="round"
              initial={{ strokeDasharray: '0 100' }}
              whileInView={{ strokeDasharray: `${bonusPercent * 0.88} ${100 - bonusPercent * 0.88}` }}
              viewport={{ once: true }}
              transition={{ duration: 1, delay: 0.5, ease: [0.22, 1, 0.36, 1] }}
            />
          </svg>
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontFamily: 'var(--font-display)',
              fontWeight: 700,
              fontSize: 'var(--text-sm)',
              color: 'var(--text-primary)',
            }}
          >
            {formatNumber(total, 0)}
          </div>
        </div>

        <div style={{ display: 'grid', gap: 'var(--space-md)', flex: 1 }}>
          <LegendItem color="#F7931A" label="Base Emission" value={formatNumber(r.baseEmission)} percent={basePercent} />
          <LegendItem color="#FFB84D" label="Sell-Pressure Bonus" value={formatNumber(r.sellPressureBonus)} percent={bonusPercent} />
        </div>
      </div>

      {/* Boost info */}
      <div
        style={{
          padding: 'var(--space-md)',
          background: 'var(--surface-raised)',
          borderRadius: 'var(--radius-md)',
          display: 'grid',
          gap: 'var(--space-sm)',
          fontSize: 'var(--text-sm)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ color: 'var(--text-muted)' }}>Staker Boost</span>
          <span style={{ color: 'var(--color-success)', fontFamily: 'var(--font-display)', fontWeight: 600 }}>
            {(r.boostMultiplier * 100).toFixed(0)}%
          </span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ color: 'var(--text-muted)' }}>Time Multiplier</span>
          <span style={{ color: 'var(--text-accent)', fontFamily: 'var(--font-display)', fontWeight: 600 }}>
            {(r.timeMultiplier * 100).toFixed(1)}%
          </span>
        </div>
      </div>
    </Card>
  );
}

function LegendItem({
  color,
  label,
  value,
  percent,
}: {
  color: string;
  label: string;
  value: string;
  percent: number;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)' }}>
      <div
        style={{
          width: 10,
          height: 10,
          borderRadius: 'var(--radius-full)',
          background: color,
          flexShrink: 0,
          boxShadow: `0 0 6px ${color}40`,
        }}
      />
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>{label}</div>
        <div style={{ fontFamily: 'var(--font-display)', fontWeight: 600, color: 'var(--text-primary)', fontSize: 'var(--text-sm)' }}>
          {value} <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>({percent.toFixed(1)}%)</span>
        </div>
      </div>
    </div>
  );
}
