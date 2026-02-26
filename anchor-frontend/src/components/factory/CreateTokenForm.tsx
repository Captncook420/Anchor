import { useState, useCallback, useRef } from 'react';
import { Card } from '../common/Card';
import { Button } from '../common/Button';
import { useToast } from '../common/Toast';
import { useWallet } from '../../hooks/useWallet';
import { numberToBigint } from '../../utils/bigint';
import {
  launchToken,
  LAUNCH_STEPS,
  type LaunchStep,
  type LaunchResult,
  type StepStatus,
} from '../../services/DeploymentService';

function initSteps(): LaunchStep[] {
  return LAUNCH_STEPS.map((s) => ({ ...s, status: 'pending' as StepStatus }));
}

export function CreateTokenForm({ onLaunchComplete }: { onLaunchComplete?: () => void } = {}) {
  const [name, setName] = useState('');
  const [symbol, setSymbol] = useState('');
  const [motoAmount, setMotoAmount] = useState('');
  const [launching, setLaunching] = useState(false);
  const [steps, setSteps] = useState<LaunchStep[]>(initSteps);
  const [result, setResult] = useState<LaunchResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef(false);
  const { addToast } = useToast();
  const { connected, provider, network, walletAddress, address } = useWallet();

  const isValid = name.length > 0 && symbol.length > 0 && Number(motoAmount) > 0;
  const showStepper = launching || result !== null || error !== null;

  const handleStep = useCallback(
    (stepId: string, update: Partial<LaunchStep>) => {
      setSteps((prev) =>
        prev.map((s) => (s.id === stepId ? { ...s, ...update } : s)),
      );
    },
    [],
  );

  const handleLaunch = useCallback(async () => {
    if (!address || !walletAddress) return;
    setLaunching(true);
    setError(null);
    setResult(null);
    setSteps(initSteps());
    abortRef.current = false;

    try {
      const moto = numberToBigint(Number(motoAmount));
      const launchResult = await launchToken(
        { name, symbol, motoAmount: moto },
        provider,
        network,
        walletAddress,
        address,
        handleStep,
      );
      setResult(launchResult);
      onLaunchComplete?.();
      addToast({
        type: 'success',
        title: 'Token Launched',
        message: `${name} ($${symbol}) deployed successfully!`,
      });
    } catch (err: unknown) {
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

      addToast({ type: 'error', title: 'Launch Failed', message: msg });
    } finally {
      setLaunching(false);
    }
  }, [name, symbol, motoAmount, address, walletAddress, provider, network, addToast, handleStep]);

  const handleReset = useCallback(() => {
    setSteps(initSteps());
    setResult(null);
    setError(null);
    setName('');
    setSymbol('');
    setMotoAmount('');
  }, []);

  return (
    <Card glow>
      <h2 style={headerStyle}>Launch a Token</h2>
      <p style={subtitleStyle}>
        Deploy a child token + staker pair. 5% goes to you, 95% seeds LP with MOTO.
      </p>

      {!showStepper ? (
        <div style={{ display: 'grid', gap: 'var(--space-lg)' }}>
          <Field label="Token Name" placeholder="e.g. SatoshiDoge" value={name} onChange={setName} />
          <Field
            label="Token Symbol"
            placeholder="e.g. SDOGE"
            value={symbol}
            onChange={setSymbol}
            maxLength={8}
          />
          <Field
            label="MOTO Amount"
            placeholder="Amount of MOTO for initial LP"
            value={motoAmount}
            onChange={setMotoAmount}
            type="number"
          />

          <div style={infoBoxStyle}>
            <InfoRow label="Total Supply" value="1,000,000,000" />
            <InfoRow label="Creator Allocation" value="5% (50,000,000)" />
            <InfoRow label="LP Allocation" value="95% (950,000,000)" />
            <InfoRow label="Platform Fee" value="1% of staking emissions" />
            <InfoRow label="Creator Dev Fee" value="10% (goes to you)" />
          </div>

          <Button
            fullWidth
            size="lg"
            disabled={!isValid || !connected}
            onClick={() => void handleLaunch()}
          >
            {!connected ? 'Connect Wallet' : 'Launch Token'}
          </Button>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 'var(--space-lg)' }}>
          {/* Stepper */}
          <div style={{ display: 'grid', gap: 'var(--space-sm)' }}>
            {steps.map((step, i) => (
              <StepRow key={step.id} step={step} index={i} />
            ))}
          </div>

          {/* Error */}
          {error && (
            <div style={errorBoxStyle}>
              <span style={{ fontWeight: 600 }}>Error:</span> {error}
            </div>
          )}

          {/* Result */}
          {result && (
            <div style={successBoxStyle}>
              <div style={{ fontWeight: 600, marginBottom: 'var(--space-sm)' }}>
                {name} (${symbol}) launched!
              </div>
              <ResultRow label="Token" value={result.childToken} />
              <ResultRow label="Staker" value={result.childStaker} />
              <ResultRow label="LP Pair" value={result.lpPair} />
            </div>
          )}

          {/* Actions */}
          {!launching && (
            <Button fullWidth variant="secondary" onClick={handleReset}>
              Launch Another Token
            </Button>
          )}
        </div>
      )}
    </Card>
  );
}

// ── Step Row ──

function StepRow({ step, index }: { step: LaunchStep; index: number }) {
  const icon = stepIcon(step.status);
  const color = stepColor(step.status);

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-md)', padding: '10px 0' }}>
      <div
        style={{
          width: 28,
          height: 28,
          borderRadius: 'var(--radius-full)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 'var(--text-sm)',
          fontWeight: 600,
          background: color.bg,
          color: color.fg,
          border: `1px solid ${color.border}`,
          flexShrink: 0,
          transition: 'all 0.3s ease',
        }}
      >
        {icon ?? index + 1}
      </div>
      <div style={{ flex: 1 }}>
        <div
          style={{
            fontSize: 'var(--text-sm)',
            fontWeight: 500,
            color: step.status === 'pending' ? 'var(--text-muted)' : 'var(--text-primary)',
          }}
        >
          {step.label}
        </div>
        {step.result && (
          <div
            style={{
              fontSize: 'var(--text-xs)',
              color: 'var(--text-muted)',
              fontFamily: 'var(--font-mono, monospace)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              maxWidth: 300,
            }}
          >
            {step.result}
          </div>
        )}
      </div>
      {step.status === 'active' && <Spinner />}
    </div>
  );
}

function stepIcon(status: StepStatus): string | null {
  if (status === 'done') return '\u2713';
  if (status === 'error') return '\u2717';
  return null;
}

function stepColor(status: StepStatus) {
  switch (status) {
    case 'done':
      return { bg: 'rgba(34,197,94,0.15)', fg: 'var(--color-success)', border: 'rgba(34,197,94,0.3)' };
    case 'active':
      return { bg: 'rgba(59,130,246,0.15)', fg: 'var(--accent)', border: 'rgba(59,130,246,0.3)' };
    case 'error':
      return { bg: 'rgba(239,68,68,0.15)', fg: 'var(--color-error)', border: 'rgba(239,68,68,0.3)' };
    default:
      return { bg: 'var(--surface-raised)', fg: 'var(--text-muted)', border: 'var(--border-subtle)' };
  }
}

function Spinner() {
  return (
    <div
      style={{
        width: 16,
        height: 16,
        border: '2px solid var(--border-subtle)',
        borderTopColor: 'var(--accent)',
        borderRadius: '50%',
        animation: 'spin 0.8s linear infinite',
      }}
    />
  );
}

// ── Shared sub-components ──

function Field({
  label,
  placeholder,
  value,
  onChange,
  type = 'text',
  maxLength,
}: {
  label: string;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  maxLength?: number;
}) {
  return (
    <div>
      <label style={labelStyle}>{label}</label>
      <input
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        maxLength={maxLength}
        style={inputStyle}
        onFocus={(e) => { e.target.style.borderColor = 'var(--accent)'; }}
        onBlur={(e) => { e.target.style.borderColor = 'var(--border-subtle)'; }}
      />
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
      <span style={{ color: 'var(--text-muted)' }}>{label}</span>
      <span style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-display)', fontWeight: 500 }}>
        {value}
      </span>
    </div>
  );
}

function ResultRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ fontSize: 'var(--text-xs)', marginBottom: 4 }}>
      <span style={{ color: 'var(--text-muted)' }}>{label}: </span>
      <span
        style={{
          color: 'var(--text-secondary)',
          fontFamily: 'var(--font-mono, monospace)',
          wordBreak: 'break-all',
        }}
      >
        {value}
      </span>
    </div>
  );
}

// ── Styles ──

const headerStyle: React.CSSProperties = {
  fontFamily: 'var(--font-display)',
  fontSize: 'var(--text-2xl)',
  fontWeight: 700,
  color: 'var(--text-primary)',
  marginBottom: 'var(--space-xs)',
};

const subtitleStyle: React.CSSProperties = {
  fontSize: 'var(--text-sm)',
  color: 'var(--text-muted)',
  marginBottom: 'var(--space-xl)',
};

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: 'var(--text-sm)',
  color: 'var(--text-secondary)',
  marginBottom: 'var(--space-sm)',
  fontWeight: 500,
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '12px 16px',
  background: 'var(--surface-raised)',
  border: '1px solid var(--border-subtle)',
  borderRadius: 'var(--radius-md)',
  fontFamily: 'var(--font-body)',
  fontSize: 'var(--text-base)',
  color: 'var(--text-primary)',
  transition: 'border-color var(--duration-fast) var(--ease-out)',
};

const infoBoxStyle: React.CSSProperties = {
  padding: 'var(--space-md)',
  background: 'var(--surface-raised)',
  borderRadius: 'var(--radius-md)',
  fontSize: 'var(--text-sm)',
  display: 'grid',
  gap: 'var(--space-sm)',
};

const errorBoxStyle: React.CSSProperties = {
  padding: 'var(--space-md)',
  background: 'rgba(239,68,68,0.08)',
  border: '1px solid rgba(239,68,68,0.2)',
  borderRadius: 'var(--radius-md)',
  fontSize: 'var(--text-sm)',
  color: 'var(--color-error)',
  wordBreak: 'break-word',
};

const successBoxStyle: React.CSSProperties = {
  padding: 'var(--space-md)',
  background: 'rgba(34,197,94,0.08)',
  border: '1px solid rgba(34,197,94,0.2)',
  borderRadius: 'var(--radius-md)',
  fontSize: 'var(--text-sm)',
  color: 'var(--text-primary)',
};
