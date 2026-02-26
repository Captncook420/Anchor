import { type ReactNode, type HTMLAttributes } from 'react';
import { motion, type Variants } from 'framer-motion';
import styles from './Card.module.css';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  hoverable?: boolean;
  compact?: boolean;
  noPadding?: boolean;
  glow?: boolean;
  delay?: number;
  children: ReactNode;
}

const cardVariants: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: (delay: number) => ({
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.5,
      delay,
      ease: [0.22, 1, 0.36, 1],
    },
  }),
};

export function Card({
  hoverable = false,
  compact = false,
  noPadding = false,
  glow = false,
  delay = 0,
  className,
  children,
  ...props
}: CardProps) {
  const classes = [
    styles.card,
    hoverable ? styles.hoverable : '',
    compact ? styles.compact : '',
    noPadding ? styles.noPadding : '',
    glow ? styles.glow : '',
    className ?? '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <motion.div
      className={classes}
      variants={cardVariants}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: '-40px' }}
      custom={delay}
      {...(props as Record<string, unknown>)}
    >
      {children}
    </motion.div>
  );
}

export function CardTitle({ children }: { children: ReactNode }) {
  return <h3 className={styles.cardTitle}>{children}</h3>;
}

export function CardSubtitle({ children }: { children: ReactNode }) {
  return <p className={styles.cardSubtitle}>{children}</p>;
}
