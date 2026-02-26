import { useState } from 'react';
import { NavLink, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { NAV_LINKS } from '../../utils/constants';
import { formatAddress } from '../../utils/format';
import { useWallet } from '../../hooks/useWallet';
import styles from './Navbar.module.css';

export function Navbar() {
  const { connected, connecting, walletAddress, connect, disconnect } = useWallet();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <motion.header
      className={styles.navbar}
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
    >
      <Link to="/dashboard" className={styles.logo}>
        <div className={styles.logoIcon}>A</div>
        <span className={styles.logoText}>ANCHOR</span>
      </Link>

      <nav className={`${styles.nav} ${mobileOpen ? styles.mobileOpen : ''}`}>
        {NAV_LINKS.map((link) => (
          <NavLink
            key={link.path}
            to={link.path}
            onClick={() => setMobileOpen(false)}
            className={({ isActive }) =>
              `${styles.navLink} ${isActive ? styles.navLinkActive : ''}`
            }
          >
            {link.label}
          </NavLink>
        ))}
      </nav>

      <div className={styles.actions}>
        {connected && walletAddress ? (
          <button
            className={styles.walletBtn}
            onClick={disconnect}
          >
            <span className={styles.walletDot} />
            {formatAddress(walletAddress)}
          </button>
        ) : (
          <button
            className={styles.walletBtn}
            onClick={connect}
            disabled={connecting}
          >
            {connecting ? 'Connecting...' : 'Connect Wallet'}
          </button>
        )}

        <button
          className={styles.mobileMenuBtn}
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-label="Toggle navigation"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            {mobileOpen ? (
              <path d="M18 6L6 18M6 6l12 12" />
            ) : (
              <path d="M3 12h18M3 6h18M3 18h18" />
            )}
          </svg>
        </button>
      </div>
    </motion.header>
  );
}
