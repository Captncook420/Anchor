import { type ReactNode } from 'react';
import { motion } from 'framer-motion';

interface PageTransitionProps {
  children: ReactNode;
}

const pageVariants = {
  initial: { opacity: 0, y: 12 },
  animate: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.4,
      ease: [0.22, 1, 0.36, 1] as [number, number, number, number],
      staggerChildren: 0.06,
    },
  },
  exit: {
    opacity: 0,
    y: -8,
    transition: { duration: 0.2 },
  },
};

export function PageTransition({ children }: PageTransitionProps) {
  return (
    <motion.main
      variants={pageVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      style={{
        flex: 1,
        width: '100%',
        maxWidth: 1200,
        margin: '0 auto',
        padding: 'var(--space-2xl) var(--space-xl)',
      }}
    >
      {children}
    </motion.main>
  );
}
