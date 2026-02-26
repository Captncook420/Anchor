import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { WalletConnectProvider } from '@btc-vision/walletconnect';
import './styles/global.css';
import App from './App';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <WalletConnectProvider theme="dark">
      <App />
    </WalletConnectProvider>
  </StrictMode>,
);
