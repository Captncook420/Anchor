import { useRef, useCallback } from 'react';
import { PageTransition } from '../components/Layout/PageTransition';
import { CreateTokenForm } from '../components/factory/CreateTokenForm';
import { TokenGallery } from '../components/factory/TokenGallery';
import styles from './Factory.module.css';

export function Factory() {
  const galleryRefresh = useRef<(() => void) | null>(null);

  const handleLaunchComplete = useCallback(() => {
    galleryRefresh.current?.();
  }, []);

  return (
    <PageTransition>
      <div style={{ marginBottom: 'var(--space-xl)' }}>
        <h1
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 'var(--text-3xl)',
            fontWeight: 700,
            color: 'var(--text-primary)',
            marginBottom: 'var(--space-xs)',
          }}
        >
          Token Factory
        </h1>
        <p style={{ color: 'var(--text-secondary)' }}>
          Launch your own token on Bitcoin L1 with built-in staking and ANCHOR flywheel integration.
        </p>
      </div>

      <div className={styles.grid}>
        <CreateTokenForm onLaunchComplete={handleLaunchComplete} />
        <TokenGallery refreshRef={galleryRefresh} />
      </div>
    </PageTransition>
  );
}
