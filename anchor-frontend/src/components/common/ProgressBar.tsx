import { motion } from 'framer-motion';

interface ProgressBarProps {
  value: number;
  max?: number;
  label?: string;
  showPercent?: boolean;
  height?: number;
  accentColor?: string;
}

export function ProgressBar({
  value,
  max = 100,
  label,
  showPercent = true,
  height = 8,
  accentColor,
}: ProgressBarProps) {
  const percent = Math.min((value / max) * 100, 100);

  return (
    <div>
      {(label || showPercent) && (
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            marginBottom: 'var(--space-sm)',
            fontSize: 'var(--text-sm)',
          }}
        >
          {label && <span style={{ color: 'var(--text-secondary)' }}>{label}</span>}
          {showPercent && (
            <span
              style={{
                color: 'var(--text-accent)',
                fontFamily: 'var(--font-display)',
                fontWeight: 600,
              }}
            >
              {percent.toFixed(1)}%
            </span>
          )}
        </div>
      )}
      <div
        style={{
          width: '100%',
          height,
          background: 'var(--surface-interactive)',
          borderRadius: 'var(--radius-full)',
          overflow: 'hidden',
          position: 'relative',
        }}
      >
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${percent}%` }}
          transition={{ duration: 1, ease: [0.22, 1, 0.36, 1], delay: 0.2 }}
          style={{
            height: '100%',
            background: accentColor
              ? accentColor
              : 'linear-gradient(90deg, var(--accent) 0%, var(--accent-hover) 100%)',
            borderRadius: 'var(--radius-full)',
            position: 'relative',
            boxShadow: '0 0 12px var(--accent-glow)',
          }}
        >
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background:
                'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.2) 50%, transparent 100%)',
              backgroundSize: '200% 100%',
              animation: 'shimmer 2s linear infinite',
              borderRadius: 'var(--radius-full)',
            }}
          />
        </motion.div>
      </div>
    </div>
  );
}
