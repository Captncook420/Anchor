import { useState, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Button } from '../components/common/Button';
import styles from './Disclaimer.module.css';

interface DisclaimerProps {
  onAccept: () => void;
}

export function Disclaimer({ onAccept }: DisclaimerProps) {
  const [scrolledToBottom, setScrolledToBottom] = useState(false);
  const [checked, setChecked] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 30;
    if (atBottom) setScrolledToBottom(true);
  }, []);

  return (
    <div className={styles.backdrop}>
      <motion.div
        className={styles.card}
        initial={{ opacity: 0, scale: 0.94, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      >
        <div className={styles.iconRow}>
          <div className={styles.icon}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#F7931A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
              <line x1="12" y1="9" x2="12" y2="13"/>
              <line x1="12" y1="17" x2="12.01" y2="17"/>
            </svg>
          </div>
          <div>
            <h1 className={styles.title}>Protocol Disclaimer</h1>
            <p className={styles.subtitle}>Please review before proceeding</p>
          </div>
        </div>

        <div className={styles.scrollArea} ref={scrollRef} onScroll={handleScroll}>
          <h3>Experimental Software</h3>
          <p>
            ANCHOR Protocol is experimental software, deployed on Bitcoin Layer 1. The protocol, its contracts, and all associated interfaces are provided strictly on an "as-is" basis with no warranties of any kind.
          </p>

          <h3>Financial Risk</h3>
          <p>
            Interacting with this protocol involves financial risk. Token prices are volatile and staking rewards are not guaranteed.
          </p>
          <p>
            Smart contract risk: bugs or exploits may result in loss of funds.
          </p>
          <p>
            Nothing presented in this interface constitutes financial or investment advice. You are solely responsible for evaluating the risks and merits of any interaction with this protocol. Consult qualified professionals before making financial decisions.
          </p>

          <h3>Regulatory Compliance</h3>
          <p>
            You are responsible for ensuring that your use of this protocol complies with all applicable laws and regulations in your jurisdiction. Access to this protocol may be restricted in certain regions.
          </p>

          <h3>No Guarantees</h3>
          <p>
            The development team makes no representations regarding the security, suitability, or reliability of this software. Use of this protocol is entirely at your own risk and discretion.
          </p>
        </div>

        <div className={`${styles.scrollHint} ${scrolledToBottom ? styles.scrollHintHidden : ''}`}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 5v14M19 12l-7 7-7-7"/>
          </svg>
          Scroll to read the full disclaimer
        </div>

        <div
          className={styles.checkboxRow}
          onClick={() => scrolledToBottom && setChecked(!checked)}
          style={{ opacity: scrolledToBottom ? 1 : 0.4, pointerEvents: scrolledToBottom ? 'auto' : 'none' }}
        >
          <div className={`${styles.checkbox} ${checked ? styles.checkboxChecked : ''}`}>
            {checked && (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#0a0a0f" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
            )}
          </div>
          <span className={styles.checkboxLabel}>
            I have read and understood the risks. I accept full responsibility for my interactions with this protocol.
          </span>
        </div>

        <Button
          fullWidth
          size="lg"
          disabled={!checked || !scrolledToBottom}
          onClick={onAccept}
          glowPulse={checked && scrolledToBottom}
        >
          I Understand & Accept
        </Button>
      </motion.div>
    </div>
  );
}
