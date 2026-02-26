import { PageTransition } from '../components/Layout/PageTransition';
import { Card } from '../components/common/Card';
import { ErrorBoundary } from '../components/common/ErrorBoundary';
import { HeroSection } from '../components/dashboard/HeroSection';
import { StatsBar } from '../components/dashboard/StatsBar';
import { FlywheelDiagram } from '../components/dashboard/FlywheelDiagram';
import { HowItWorks } from '../components/dashboard/HowItWorks';
import { FeatureCards } from '../components/dashboard/FeatureCards';
import { TransactionHistory } from '../components/staking/TransactionHistory';
import { GlobalActivityFeed } from '../components/activity/GlobalActivityFeed';

export function Dashboard() {
  return (
    <PageTransition>
      <HeroSection />
      <StatsBar />

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 420px), 1fr))',
          gap: 'var(--space-xl)',
          marginBottom: 'var(--space-2xl)',
        }}
      >
        <Card>
          <ErrorBoundary>
            <TransactionHistory embedded />
          </ErrorBoundary>
        </Card>
        <Card>
          <ErrorBoundary>
            <GlobalActivityFeed />
          </ErrorBoundary>
        </Card>
      </div>

      <FlywheelDiagram />
      <HowItWorks />
      <FeatureCards />
    </PageTransition>
  );
}
