import { motion } from 'framer-motion';
import { StatCounter } from '../common/StatCounter';
import { useProtocolStats } from '../../hooks/useProtocolStats';

export function StatsBar() {
  const { stats, loading } = useProtocolStats();

  if (loading) {
    return (
      <section
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
          gap: 'var(--space-xl)',
          padding: 'var(--space-xl) var(--space-lg)',
          borderTop: '1px solid var(--border-subtle)',
          borderBottom: '1px solid var(--border-subtle)',
          background: 'rgba(13, 13, 20, 0.5)',
          borderRadius: 'var(--radius-lg)',
          backdropFilter: 'blur(8px)',
          minHeight: 80,
        }}
      />
    );
  }

  return (
    <motion.section
      initial={{ opacity: 0 }}
      whileInView={{ opacity: 1 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5 }}
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
        gap: 'var(--space-xl)',
        padding: 'var(--space-xl) var(--space-lg)',
        borderTop: '1px solid var(--border-subtle)',
        borderBottom: '1px solid var(--border-subtle)',
        background: 'rgba(13, 13, 20, 0.5)',
        borderRadius: 'var(--radius-lg)',
        backdropFilter: 'blur(8px)',
      }}
    >
      <StatCounter
        value={stats.tvl}
        label="Total Value Locked"
        prefix="$"
        decimals={0}
      />
      <StatCounter
        value={stats.anchorPrice}
        label="ANCHOR Price"
        prefix="$"
        decimals={4}
      />
      <StatCounter
        value={stats.apy}
        label="Staking APY"
        suffix="%"
        decimals={1}
      />
      <StatCounter
        value={stats.totalHolders}
        label="Holders"
        decimals={0}
      />
      <StatCounter
        value={stats.totalBurned}
        label="LP Burned"
        prefix="$"
        decimals={0}
      />
    </motion.section>
  );
}
