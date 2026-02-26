import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Button } from '../common/Button';

export function HeroSection() {
  const navigate = useNavigate();

  return (
    <section
      style={{
        textAlign: 'center',
        padding: 'var(--space-4xl) 0 var(--space-3xl)',
        position: 'relative',
      }}
    >
      {/* Glow orbs */}
      <div
        style={{
          position: 'absolute',
          top: '-20%',
          left: '10%',
          width: '40%',
          height: '60%',
          background: 'radial-gradient(circle, rgba(247,147,26,0.06) 0%, transparent 70%)',
          filter: 'blur(60px)',
          pointerEvents: 'none',
        }}
      />
      <div
        style={{
          position: 'absolute',
          bottom: '-10%',
          right: '5%',
          width: '35%',
          height: '50%',
          background: 'radial-gradient(circle, rgba(247,147,26,0.04) 0%, transparent 70%)',
          filter: 'blur(60px)',
          pointerEvents: 'none',
        }}
      />

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        style={{ position: 'relative' }}
      >
        {/* Badge */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.1, duration: 0.4 }}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 'var(--space-sm)',
            padding: '6px 16px',
            background: 'var(--accent-muted)',
            border: '1px solid var(--border-accent)',
            borderRadius: 'var(--radius-full)',
            fontSize: 'var(--text-sm)',
            color: 'var(--accent)',
            fontWeight: 500,
            marginBottom: 'var(--space-xl)',
          }}
        >
          <span
            style={{
              width: 6,
              height: 6,
              borderRadius: 'var(--radius-full)',
              background: 'var(--accent)',
              boxShadow: '0 0 6px var(--accent-glow)',
            }}
          />
          Bitcoin L1 DeFi Protocol
        </motion.div>

        {/* Headline */}
        <h1
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 'var(--text-hero)',
            fontWeight: 800,
            lineHeight: 'var(--leading-tight)',
            color: 'var(--text-primary)',
            maxWidth: '14ch',
            margin: '0 auto var(--space-lg)',
          }}
        >
          The Self-Reinforcing{' '}
          <span
            style={{
              background: 'linear-gradient(135deg, var(--accent) 0%, var(--accent-hover) 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}
          >
            Bitcoin DeFi
          </span>{' '}
          Engine
        </h1>

        {/* Subheadline */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2, duration: 0.5 }}
          style={{
            fontSize: 'var(--text-lg)',
            color: 'var(--text-secondary)',
            maxWidth: '52ch',
            margin: '0 auto var(--space-2xl)',
            lineHeight: 'var(--leading-relaxed)',
          }}
        >
          Stake LP tokens, earn sell-pressure rewards, and participate in a flywheel where every new token launch amplifies ANCHOR value.
        </motion.p>

        {/* CTAs */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35, duration: 0.4 }}
          style={{
            display: 'flex',
            gap: 'var(--space-md)',
            justifyContent: 'center',
            flexWrap: 'wrap',
          }}
        >
          <Button size="lg" onClick={() => navigate('/stake')} glowPulse>
            Start Staking
          </Button>
          <Button variant="secondary" size="lg" onClick={() => navigate('/factory')}>
            Launch Token
          </Button>
        </motion.div>
      </motion.div>
    </section>
  );
}
