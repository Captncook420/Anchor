import { useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import { useDisclaimerGate } from './hooks/useDisclaimerGate';
import { Disclaimer } from './pages/Disclaimer';
import { Dashboard } from './pages/Dashboard';
import { Stake } from './pages/Stake';
import { Factory } from './pages/Factory';
import { TokenDetail } from './pages/TokenDetail';
import { Navbar } from './components/Layout/Navbar';
import { Footer } from './components/Layout/Footer';
import { ParticleCanvas } from './components/Layout/ParticleCanvas';
import { ToastProvider } from './components/common/Toast';
import { DeploymentProvider } from './contexts/DeploymentContext';

export default function App() {
  const [accepted, accept] = useDisclaimerGate();
  const [showDisclaimer, setShowDisclaimer] = useState(!accepted);

  const handleAccept = () => {
    accept();
    setShowDisclaimer(false);
  };

  return (
    <ToastProvider>
      <DeploymentProvider>
      <ParticleCanvas />

      <AnimatePresence mode="wait">
        {showDisclaimer ? (
          <Disclaimer key="disclaimer" onAccept={handleAccept} />
        ) : (
          <BrowserRouter key="app">
            <Navbar />
            <Routes>
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/stake" element={<Stake />} />
              <Route path="/factory" element={<Factory />} />
              <Route path="/token/:address" element={<TokenDetail />} />
            </Routes>
            <Footer />
          </BrowserRouter>
        )}
      </AnimatePresence>
      </DeploymentProvider>
    </ToastProvider>
  );
}
