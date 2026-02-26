import styles from './Footer.module.css';

export function Footer() {
  return (
    <footer className={styles.footer}>
      <div className={styles.footerInner}>
        <div className={styles.brand}>
          ANCHOR Protocol
          <span className={styles.badge}>
            <span className={styles.badgeDot} />
            Built on OPNet
          </span>
        </div>
        <div className={styles.links}>
          <a href="#" className={styles.link}>Docs</a>
          <a href="#" className={styles.link}>GitHub</a>
          <a href="#" className={styles.link}>Twitter</a>
          <a href="#" className={styles.link}>Discord</a>
        </div>
      </div>
    </footer>
  );
}
