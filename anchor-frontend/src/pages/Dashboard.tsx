import { PageTransition } from '../components/Layout/PageTransition';
import { HeroSection } from '../components/dashboard/HeroSection';
import { StatsBar } from '../components/dashboard/StatsBar';
import { FlywheelDiagram } from '../components/dashboard/FlywheelDiagram';
import { HowItWorks } from '../components/dashboard/HowItWorks';
import { FeatureCards } from '../components/dashboard/FeatureCards';

export function Dashboard() {
  return (
    <PageTransition>
      <HeroSection />
      <StatsBar />
      <FlywheelDiagram />
      <HowItWorks />
      <FeatureCards />
    </PageTransition>
  );
}
