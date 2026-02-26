import { motion } from 'framer-motion';
import { useGlobalActivity } from '../../hooks/useGlobalActivity';
import { formatTimeAgo, formatAddress } from '../../utils/format';
import type { Activity } from '../../types';

const TYPE_STYLES: Record<string, { color: string; bg: string; label: string }> = {
  stake: { color: '#22c55e', bg: 'rgba(34, 197, 94, 0.1)', label: 'Stake' },
  unstake: { color: '#ef4444', bg: 'rgba(239, 68, 68, 0.1)', label: 'Unstake' },
  claim: { color: '#3b82f6', bg: 'rgba(59, 130, 246, 0.1)', label: 'Claim' },
  compound: { color: 'var(--accent)', bg: 'var(--accent-muted)', label: 'Compound' },
  buy: { color: '#22c55e', bg: 'rgba(34, 197, 94, 0.1)', label: 'Trade' },
  sell: { color: '#ef4444', bg: 'rgba(239, 68, 68, 0.1)', label: 'Sell' },
  lp: { color: '#a855f7', bg: 'rgba(168, 85, 247, 0.1)', label: 'LP' },
  create: { color: '#3b82f6', bg: 'rgba(59, 130, 246, 0.1)', label: 'Create' },
  harvest: { color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.1)', label: 'Harvest' },
  approve: { color: 'var(--text-muted)', bg: 'rgba(148, 163, 184, 0.1)', label: 'Approve' },
};

function getDescription(activity: Activity): string {
  const symbol = activity.tokenSymbol ?? 'Contract';
  switch (activity.type) {
    case 'create': return `Deployed ${symbol}`;
    case 'stake': return `Staking on ${symbol}`;
    case 'buy': return `Trade on ${symbol}`;
    case 'sell': return `Sold ${symbol}`;
    case 'lp': return `LP on ${symbol}`;
    case 'claim': return `Claimed from ${symbol}`;
    case 'compound': return `Compounded on ${symbol}`;
    case 'harvest': return `Harvested ${symbol}`;
    default: return `Interacted with ${symbol}`;
  }
}

export function GlobalActivityFeed() {
  const { activities, loading } = useGlobalActivity();

  if (loading) {
    return (
      <>
        <h3
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 'var(--text-lg)',
            fontWeight: 600,
            color: 'var(--text-primary)',
            marginBottom: 'var(--space-lg)',
          }}
        >
          Global Activity
        </h3>
        <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>
          Scanning blockchain...
        </p>
      </>
    );
  }

  return (
    <>
      <h3
        style={{
          fontFamily: 'var(--font-display)',
          fontSize: 'var(--text-lg)',
          fontWeight: 600,
          color: 'var(--text-primary)',
          marginBottom: 'var(--space-lg)',
        }}
      >
        Global Activity
      </h3>

      {activities.length === 0 ? (
        <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>
          No recent activity found on ANCHOR contracts.
        </p>
      ) : (
        <div
          style={{
            display: 'grid',
            gap: 'var(--space-sm)',
            maxHeight: '400px',
            overflowY: 'auto',
            paddingRight: '4px',
          }}
        >
          {activities.map((activity, i) => {
            const style = TYPE_STYLES[activity.type] ?? TYPE_STYLES['buy']!;
            return (
              <motion.div
                key={activity.id}
                initial={{ opacity: 0, x: -12 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: Math.min(i * 0.04, 0.5), duration: 0.3 }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: 'var(--space-md)',
                  background: 'var(--surface-raised)',
                  borderRadius: 'var(--radius-md)',
                  gap: 'var(--space-md)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-md)', minWidth: 0 }}>
                  <span
                    style={{
                      padding: '4px 10px',
                      background: style.bg,
                      color: style.color,
                      borderRadius: 'var(--radius-sm)',
                      fontSize: 'var(--text-xs)',
                      fontWeight: 600,
                      fontFamily: 'var(--font-display)',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {style.label}
                  </span>
                  <div style={{ minWidth: 0 }}>
                    <div
                      style={{
                        fontFamily: 'var(--font-display)',
                        fontWeight: 600,
                        fontSize: 'var(--text-sm)',
                        color: 'var(--text-primary)',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {getDescription(activity)}
                    </div>
                    <div
                      style={{
                        fontSize: 'var(--text-xs)',
                        color: 'var(--text-muted)',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {activity.wallet ? formatAddress(activity.wallet, 8, 6) : activity.txHash.slice(0, 16) + '...'}
                    </div>
                  </div>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div
                    style={{
                      fontSize: 'var(--text-xs)',
                      color: 'var(--color-success)',
                      fontWeight: 500,
                    }}
                  >
                    Confirmed
                  </div>
                  <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                    {formatTimeAgo(activity.timestamp)}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </>
  );
}
