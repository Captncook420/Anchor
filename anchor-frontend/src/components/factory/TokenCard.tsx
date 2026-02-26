import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '../common/Card';
import { Button } from '../common/Button';
import { useToast } from '../common/Toast';
import { formatUsd, formatPercent } from '../../utils/format';
import { bigintToNumber } from '../../utils/bigint';
import { useWallet } from '../../hooks/useWallet';
import { harvestAndBurn, HARVEST_STEPS, type HarvestStep, type HarvestStatus } from '../../services/HarvestService';
import type { ChildToken } from '../../types';

interface TokenCardProps {
  token: ChildToken;
  delay?: number;
  onHarvestComplete?: () => void;
}

export function TokenCard({ token, delay = 0, onHarvestComplete }: TokenCardProps) {
  const navigate = useNavigate();
  const { addToast } = useToast();
  const { provider, network, walletAddress, address, connected } = useWallet();
  const [harvesting, setHarvesting] = useState(false);
  const [harvestSteps, setHarvestSteps] = useState<HarvestStep[] | null>(null);

  const positive = token.change24h >= 0;
  const hasFees = token.pendingPlatformFee > 0n;
  const feeDisplay = bigintToNumber(token.pendingPlatformFee);

  const handleStep = useCallback(
    (stepId: string, update: Partial<HarvestStep>) => {
      setHarvestSteps((prev) =>
        prev?.map((s) => (s.id === stepId ? { ...s, ...update } : s)) ?? null,
      );
    },
    [],
  );

  const handleHarvest = useCallback(
    async (e: React.MouseEvent) => {
      e.stopPropagation();
      if (!address || !walletAddress || !token.stakerAddress) return;

      setHarvesting(true);
      setHarvestSteps(HARVEST_STEPS.map((s) => ({ ...s, status: 'pending' as HarvestStatus })));

      try {
        await harvestAndBurn(
          token.address,
          token.stakerAddress,
          provider,
          network,
          walletAddress,
          address,
          handleStep,
        );
        addToast({ type: 'success', title: 'Harvest Complete', message: `Fees from $${token.symbol} harvested and burned as LP.` });
        onHarvestComplete?.();
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        addToast({ type: 'error', title: 'Harvest Failed', message: msg });

        setHarvestSteps((prev) => {
          if (!prev) return null;
          const active = prev.find((s) => s.status === 'active');
          if (!active) return prev;
          return prev.map((s) =>
            s.id === active.id ? { ...s, status: 'error' as HarvestStatus, error: msg } : s,
          );
        });
      } finally {
        setHarvesting(false);
      }
    },
    [address, walletAddress, token, provider, network, addToast, handleStep, onHarvestComplete],
  );

  return (
    <Card
      hoverable
      delay={delay}
      onClick={() => !harvesting && navigate(`/token/${token.address}`)}
      style={{ cursor: harvesting ? 'default' : 'pointer' }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--space-md)',
          marginBottom: 'var(--space-lg)',
        }}
      >
        <div style={iconStyle}>{token.symbol.charAt(0)}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={nameStyle}>{token.name}</div>
          <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>
            ${token.symbol}
          </div>
        </div>
        <div
          style={{
            padding: '4px 10px',
            borderRadius: 'var(--radius-full)',
            fontSize: 'var(--text-xs)',
            fontWeight: 600,
            fontFamily: 'var(--font-display)',
            color: positive ? 'var(--color-success)' : 'var(--color-error)',
            background: positive ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)',
          }}
        >
          {positive ? '+' : ''}{formatPercent(token.change24h)}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-md)' }}>
        <MiniStat label="TVL" value={formatUsd(token.tvl)} />
        <MiniStat label="APY" value={formatPercent(token.apy)} accent />
        <MiniStat label="Stakers" value={token.stakerCount.toLocaleString()} />
        <MiniStat label="Price" value={formatUsd(token.price)} />
      </div>

      {/* Harvest section */}
      {hasFees && (
        <div
          style={{
            marginTop: 'var(--space-lg)',
            padding: 'var(--space-md)',
            background: 'var(--surface-raised)',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border-accent)',
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: harvestSteps ? 'var(--space-sm)' : 0,
            }}
          >
            <div>
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Platform Fees
              </div>
              <div style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 'var(--text-sm)', color: 'var(--text-accent)' }}>
                {feeDisplay.toLocaleString(undefined, { maximumFractionDigits: 2 })} {token.symbol}
              </div>
            </div>
            <Button
              size="sm"
              disabled={!connected || harvesting}
              onClick={handleHarvest}
            >
              {harvesting ? 'Harvesting...' : 'Harvest'}
            </Button>
          </div>

          {/* Mini harvest stepper */}
          {harvestSteps && (
            <div style={{ fontSize: 'var(--text-xs)', display: 'grid', gap: 2 }}>
              {harvestSteps.map((s) => (
                <div
                  key={s.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    color: s.status === 'done' ? 'var(--color-success)'
                      : s.status === 'error' ? 'var(--color-error)'
                      : s.status === 'active' ? 'var(--accent)'
                      : 'var(--text-muted)',
                  }}
                >
                  <span style={{ width: 14, textAlign: 'center' }}>
                    {s.status === 'done' ? '\u2713' : s.status === 'error' ? '\u2717' : s.status === 'active' ? '\u25CB' : '\u00B7'}
                  </span>
                  {s.label}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

function MiniStat({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) {
  return (
    <div>
      <div style={miniLabelStyle}>{label}</div>
      <div
        style={{
          fontFamily: 'var(--font-display)',
          fontWeight: 600,
          fontSize: 'var(--text-sm)',
          color: accent ? 'var(--text-accent)' : 'var(--text-primary)',
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {value}
      </div>
    </div>
  );
}

const iconStyle: React.CSSProperties = {
  width: 44,
  height: 44,
  borderRadius: 'var(--radius-lg)',
  background: 'linear-gradient(135deg, var(--accent-muted) 0%, var(--surface-interactive) 100%)',
  border: '1px solid var(--border-accent)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontFamily: 'var(--font-display)',
  fontWeight: 700,
  fontSize: 'var(--text-lg)',
  color: 'var(--accent)',
  flexShrink: 0,
};

const nameStyle: React.CSSProperties = {
  fontFamily: 'var(--font-display)',
  fontWeight: 600,
  color: 'var(--text-primary)',
  fontSize: 'var(--text-base)',
};

const miniLabelStyle: React.CSSProperties = {
  fontSize: 'var(--text-xs)',
  color: 'var(--text-muted)',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  marginBottom: 2,
};
