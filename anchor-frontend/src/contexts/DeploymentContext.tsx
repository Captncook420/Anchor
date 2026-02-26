import { createContext, useContext, useState, useCallback, useRef, type ReactNode } from 'react';
import type { AbstractRpcProvider } from 'opnet';
import type { Address } from '@btc-vision/transaction';
import type { Network } from '@btc-vision/bitcoin';
import {
  launchToken,
  LAUNCH_STEPS,
  type LaunchStep,
  type LaunchResult,
  type StepStatus,
} from '../services/DeploymentService';
import { numberToBigint } from '../utils/bigint';

function initSteps(): LaunchStep[] {
  return LAUNCH_STEPS.map((s) => ({ ...s, status: 'pending' as StepStatus }));
}

interface DeploymentContextValue {
  /** Whether a launch is currently running */
  readonly launching: boolean;
  /** Current step states */
  readonly steps: LaunchStep[];
  /** Final result (token, staker, LP addresses) */
  readonly result: LaunchResult | null;
  /** Error message if launch failed */
  readonly error: string | null;
  /** Token name being deployed */
  readonly tokenName: string;
  /** Token symbol being deployed */
  readonly tokenSymbol: string;
  /** True if there's an active or finished deployment to show */
  readonly hasDeployment: boolean;
  /** Start a new token deployment */
  launch(
    name: string,
    symbol: string,
    motoAmount: string,
    provider: AbstractRpcProvider,
    network: Network,
    walletAddress: string,
    senderAddress: Address,
  ): void;
  /** Reset back to the form */
  reset(): void;
}

const DeploymentContext = createContext<DeploymentContextValue | null>(null);

export function DeploymentProvider({ children }: { children: ReactNode }) {
  const [launching, setLaunching] = useState(false);
  const [steps, setSteps] = useState<LaunchStep[]>(initSteps);
  const [result, setResult] = useState<LaunchResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tokenName, setTokenName] = useState('');
  const [tokenSymbol, setTokenSymbol] = useState('');
  const onLaunchCompleteRef = useRef<(() => void) | null>(null);

  const hasDeployment = launching || result !== null || error !== null;

  const handleStep = useCallback(
    (stepId: string, update: Partial<LaunchStep>) => {
      setSteps((prev) =>
        prev.map((s) => (s.id === stepId ? { ...s, ...update } : s)),
      );
    },
    [],
  );

  const launch = useCallback(
    (
      name: string,
      symbol: string,
      motoAmount: string,
      provider: AbstractRpcProvider,
      network: Network,
      walletAddress: string,
      senderAddress: Address,
    ) => {
      setLaunching(true);
      setError(null);
      setResult(null);
      setSteps(initSteps());
      setTokenName(name);
      setTokenSymbol(symbol);

      const moto = numberToBigint(Number(motoAmount));

      launchToken(
        { name, symbol, motoAmount: moto },
        provider,
        network,
        walletAddress,
        senderAddress,
        handleStep,
      )
        .then((launchResult) => {
          setResult(launchResult);
          onLaunchCompleteRef.current?.();
        })
        .catch((err: unknown) => {
          const msg = err instanceof Error ? err.message : String(err);
          setError(msg);
          // Mark first active step as error
          setSteps((prev) => {
            const active = prev.find((s) => s.status === 'active');
            if (!active) return prev;
            return prev.map((s) =>
              s.id === active.id ? { ...s, status: 'error' as StepStatus, error: msg } : s,
            );
          });
        })
        .finally(() => {
          setLaunching(false);
        });
    },
    [handleStep],
  );

  const reset = useCallback(() => {
    setSteps(initSteps());
    setResult(null);
    setError(null);
    setTokenName('');
    setTokenSymbol('');
  }, []);

  return (
    <DeploymentContext.Provider
      value={{
        launching,
        steps,
        result,
        error,
        tokenName,
        tokenSymbol,
        hasDeployment,
        launch,
        reset,
      }}
    >
      {children}
    </DeploymentContext.Provider>
  );
}

export function useDeployment(): DeploymentContextValue {
  const ctx = useContext(DeploymentContext);
  if (!ctx) throw new Error('useDeployment must be used within DeploymentProvider');
  return ctx;
}
