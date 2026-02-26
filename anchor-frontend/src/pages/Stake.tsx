import { PageTransition } from '../components/Layout/PageTransition';
import { PositionCard } from '../components/staking/PositionCard';
import { StakeForm } from '../components/staking/StakeForm';
import { RewardsBreakdown } from '../components/staking/RewardsBreakdown';
import { TransactionHistory } from '../components/staking/TransactionHistory';
import styles from './Stake.module.css';

export function Stake() {
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
          Staking
        </h1>
        <p style={{ color: 'var(--text-secondary)' }}>
          Stake ANCHOR/MOTO LP tokens to earn dual rewards.
        </p>
      </div>

      <div style={{ display: 'grid', gap: 'var(--space-xl)' }}>
        <PositionCard />

        <div className={styles.grid}>
          <StakeForm />
          <div style={{ display: 'grid', gap: 'var(--space-xl)', alignContent: 'start' }}>
            <RewardsBreakdown />
            <TransactionHistory />
          </div>
        </div>
      </div>
    </PageTransition>
  );
}
