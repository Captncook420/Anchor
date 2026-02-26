import { type ButtonHTMLAttributes, type ReactNode } from 'react';
import { motion } from 'framer-motion';
import styles from './Button.module.css';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  fullWidth?: boolean;
  glowPulse?: boolean;
  children: ReactNode;
}

export function Button({
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  glowPulse = false,
  className,
  children,
  ...props
}: ButtonProps) {
  const classes = [
    styles.button,
    styles[variant],
    styles[size],
    fullWidth ? styles.fullWidth : '',
    glowPulse ? styles.glowPulse : '',
    className ?? '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <motion.button
      className={classes}
      whileTap={{ scale: 0.97 }}
      {...(props as Record<string, unknown>)}
    >
      {children}
    </motion.button>
  );
}
