import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Card } from '../common/Card';
import { Button } from '../common/Button';

const FEATURES = [
  {
    title: 'Sell-Pressure Rewards',
    description:
      'Earn rewards proportional to actual sell pressure. When tokens flow into a pool, the difference accumulates as claimable rewards for stakers — a mechanism unique to ANCHOR.',
    highlight: 'Rewards grow with market activity',
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#F7931A" strokeWidth="1.5">
        <path d="M12 2L2 7l10 5 10-5-10-5z"/>
        <path d="M2 17l10 5 10-5"/>
        <path d="M2 12l10 5 10-5"/>
      </svg>
    ),
  },
  {
    title: 'Time Multiplier',
    description:
      'Your rewards multiply from 0% to 100% over 1,440 blocks (~10 days). The un-multiplied portion is permanently discarded — rewarding long-term commitment.',
    highlight: 'Patience is rewarded exponentially',
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#F7931A" strokeWidth="1.5">
        <circle cx="12" cy="12" r="10"/>
        <polyline points="12 6 12 12 16 14"/>
      </svg>
    ),
  },
  {
    title: 'Auto-Compound',
    description:
      'Compound your ANCHOR rewards back into LP tokens without resetting your time multiplier. Unlike claiming, compounding preserves your progress and amplifies future earnings.',
    highlight: 'Compound without losing multiplier',
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#F7931A" strokeWidth="1.5">
        <path d="M21.5 2v6h-6M2.5 22v-6h6"/>
        <path d="M2.5 16A10 10 0 0 1 16 2.5"/>
        <path d="M21.5 8A10 10 0 0 1 8 21.5"/>
      </svg>
    ),
  },
  {
    title: 'Token Factory',
    description:
      'Launch your own token in one transaction. The factory deploys a child token + staker pair, seeds liquidity, and auto-configures sell-pressure tracking — all on Bitcoin L1.',
    highlight: 'Launch tokens permissionlessly',
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#F7931A" strokeWidth="1.5">
        <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
        <line x1="12" y1="8" x2="12" y2="16"/>
        <line x1="8" y1="12" x2="16" y2="12"/>
      </svg>
    ),
  },
];

const containerVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.08 } },
};

export function FeatureCards() {
  const navigate = useNavigate();

  return (
    <section style={{ padding: 'var(--space-3xl) 0' }}>
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.5 }}
        style={{ textAlign: 'center', marginBottom: 'var(--space-2xl)' }}
      >
        <h2
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 'var(--text-3xl)',
            fontWeight: 700,
            color: 'var(--text-primary)',
            marginBottom: 'var(--space-sm)',
          }}
        >
          Core Features
        </h2>
        <p style={{ color: 'var(--text-secondary)', maxWidth: '48ch', margin: '0 auto' }}>
          Built from the ground up for Bitcoin L1 with novel economic mechanics.
        </p>
      </motion.div>

      <motion.div
        variants={containerVariants}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: '-40px' }}
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
          gap: 'var(--space-lg)',
        }}
      >
        {FEATURES.map((feature, i) => (
          <Card key={feature.title} hoverable delay={i * 0.08}>
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: 'var(--radius-lg)',
                background: 'var(--accent-muted)',
                border: '1px solid var(--border-accent)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: 'var(--space-lg)',
              }}
            >
              {feature.icon}
            </div>
            <h3
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: 'var(--text-lg)',
                fontWeight: 600,
                color: 'var(--text-primary)',
                marginBottom: 'var(--space-sm)',
              }}
            >
              {feature.title}
            </h3>
            <p
              style={{
                fontSize: 'var(--text-sm)',
                color: 'var(--text-secondary)',
                lineHeight: 'var(--leading-relaxed)',
                marginBottom: 'var(--space-md)',
              }}
            >
              {feature.description}
            </p>
            <span
              style={{
                fontSize: 'var(--text-xs)',
                color: 'var(--accent)',
                fontWeight: 600,
                fontFamily: 'var(--font-display)',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
              }}
            >
              {feature.highlight}
            </span>
          </Card>
        ))}
      </motion.div>

      {/* CTA Section */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.5, delay: 0.2 }}
        style={{
          textAlign: 'center',
          padding: 'var(--space-4xl) var(--space-xl)',
          marginTop: 'var(--space-3xl)',
          background: 'linear-gradient(180deg, var(--accent-muted) 0%, transparent 100%)',
          borderRadius: 'var(--radius-xl)',
          border: '1px solid var(--border-accent)',
        }}
      >
        <h2
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 'var(--text-3xl)',
            fontWeight: 700,
            color: 'var(--text-primary)',
            marginBottom: 'var(--space-md)',
          }}
        >
          Ready to Start Earning?
        </h2>
        <p
          style={{
            color: 'var(--text-secondary)',
            marginBottom: 'var(--space-xl)',
            maxWidth: '40ch',
            margin: '0 auto var(--space-xl)',
          }}
        >
          Stake your LP tokens and join the self-reinforcing flywheel.
        </p>
        <Button size="lg" glowPulse onClick={() => navigate('/stake')}>
          Start Staking Now
        </Button>
      </motion.div>
    </section>
  );
}
