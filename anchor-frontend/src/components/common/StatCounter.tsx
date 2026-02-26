import { useRef } from 'react';
import { motion, useInView } from 'framer-motion';
import { useAnimatedCounter } from '../../hooks/useAnimatedCounter';

interface StatCounterProps {
  value: number;
  label: string;
  prefix?: string;
  suffix?: string;
  decimals?: number;
  duration?: number;
}

export function StatCounter({
  value,
  label,
  prefix = '',
  suffix = '',
  decimals = 0,
  duration = 1800,
}: StatCounterProps) {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: '-60px' });
  const animatedValue = useAnimatedCounter(value, duration, isInView);

  const displayValue = decimals > 0
    ? animatedValue.toFixed(decimals)
    : Math.floor(animatedValue).toLocaleString('en-US');

  return (
    <motion.div
      ref={ref}
      style={{ textAlign: 'center' }}
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
    >
      <div
        style={{
          fontFamily: 'var(--font-display)',
          fontSize: 'var(--text-3xl)',
          fontWeight: 700,
          color: 'var(--text-accent)',
          fontVariantNumeric: 'tabular-nums',
          lineHeight: 'var(--leading-tight)',
        }}
      >
        {prefix}{displayValue}{suffix}
      </div>
      <div
        style={{
          fontSize: 'var(--text-sm)',
          color: 'var(--text-muted)',
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
          marginTop: 'var(--space-xs)',
          fontWeight: 500,
        }}
      >
        {label}
      </div>
    </motion.div>
  );
}
