import { motion } from 'framer-motion';
import { Card } from '../common/Card';

const STEPS = [
  {
    number: '01',
    title: 'Stake LP Tokens',
    description:
      'Deposit your ANCHOR/MOTO MotoSwap LP tokens into the staking contract. Your time multiplier starts building immediately.',
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#F7931A" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2v20M2 12h20"/>
        <circle cx="12" cy="12" r="10"/>
      </svg>
    ),
  },
  {
    number: '02',
    title: 'Earn Dual Rewards',
    description:
      'Collect base emissions (69,444 ANCHOR/block) plus sell-pressure bonuses whenever tokens flow through the pool. Rewards multiply over time.',
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#F7931A" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/>
        <polyline points="17 6 23 6 23 12"/>
      </svg>
    ),
  },
  {
    number: '03',
    title: 'Compound & Grow',
    description:
      'Auto-compound rewards back into LP without resetting your time multiplier. The longer you stay, the more you earn.',
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#F7931A" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21.5 2v6h-6M2.5 22v-6h6"/>
        <path d="M2.5 16A10 10 0 0 1 16 2.5"/>
        <path d="M21.5 8A10 10 0 0 1 8 21.5"/>
      </svg>
    ),
  },
];

const containerVariants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.12,
    },
  },
};

export function HowItWorks() {
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
          How It Works
        </h2>
        <p style={{ color: 'var(--text-secondary)', maxWidth: '44ch', margin: '0 auto' }}>
          Three simple steps to start earning self-reinforcing rewards on Bitcoin L1.
        </p>
      </motion.div>

      <motion.div
        variants={containerVariants}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: '-60px' }}
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: 'var(--space-lg)',
        }}
      >
        {STEPS.map((step, i) => (
          <Card key={step.number} hoverable delay={i * 0.1}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-md)',
                marginBottom: 'var(--space-lg)',
              }}
            >
              <div
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 'var(--radius-lg)',
                  background: 'var(--accent-muted)',
                  border: '1px solid var(--border-accent)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                {step.icon}
              </div>
              <span
                style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: 'var(--text-3xl)',
                  fontWeight: 800,
                  color: 'var(--accent)',
                  opacity: 0.2,
                  lineHeight: 1,
                }}
              >
                {step.number}
              </span>
            </div>
            <h3
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: 'var(--text-xl)',
                fontWeight: 600,
                color: 'var(--text-primary)',
                marginBottom: 'var(--space-sm)',
              }}
            >
              {step.title}
            </h3>
            <p
              style={{
                fontSize: 'var(--text-sm)',
                color: 'var(--text-secondary)',
                lineHeight: 'var(--leading-relaxed)',
              }}
            >
              {step.description}
            </p>
          </Card>
        ))}
      </motion.div>
    </section>
  );
}
