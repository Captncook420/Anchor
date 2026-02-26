import { motion } from 'framer-motion';
import { useChildTokens } from '../../hooks/useChildTokens';
import { TokenCard } from './TokenCard';

const containerVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.08 } },
};

export function TokenGallery({ refreshRef }: { refreshRef?: React.RefObject<(() => void) | null> }) {
  const { tokens, loading, refresh } = useChildTokens();

  // Expose refresh to parent
  if (refreshRef) refreshRef.current = refresh;

  return (
    <div>
      <h2
        style={{
          fontFamily: 'var(--font-display)',
          fontSize: 'var(--text-2xl)',
          fontWeight: 700,
          color: 'var(--text-primary)',
          marginBottom: 'var(--space-xs)',
        }}
      >
        Launched Tokens
      </h2>
      <p
        style={{
          fontSize: 'var(--text-sm)',
          color: 'var(--text-muted)',
          marginBottom: 'var(--space-xl)',
        }}
      >
        {loading ? 'Loading tokens...' : `${tokens.length} tokens deployed through the ANCHOR Factory`}
      </p>

      {!loading && tokens.length === 0 ? (
        <div
          style={{
            padding: 'var(--space-2xl)',
            textAlign: 'center',
            color: 'var(--text-muted)',
            fontSize: 'var(--text-sm)',
          }}
        >
          No tokens deployed yet. Be the first to launch one!
        </div>
      ) : (
        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
            gap: 'var(--space-lg)',
          }}
        >
          {tokens.map((token, i) => (
            <TokenCard key={token.address} token={token} delay={i * 0.08} onHarvestComplete={refresh} />
          ))}
        </motion.div>
      )}
    </div>
  );
}
