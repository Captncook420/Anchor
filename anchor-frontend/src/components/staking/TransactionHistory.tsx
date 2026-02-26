import { motion } from 'framer-motion';
import { Card } from '../common/Card';
import { useTransactionHistory } from '../../hooks/useTransactionHistory';
import { useWallet } from '../../hooks/useWallet';
import { formatNumber, formatTimeAgo } from '../../utils/format';
import type { Activity } from '../../types';

const TYPE_STYLES: Record<string, { color: string; bg: string; label: string }> = {
  stake: { color: 'var(--color-success)', bg: 'rgba(34, 197, 94, 0.1)', label: 'Stake' },
  unstake: { color: 'var(--color-error)', bg: 'rgba(239, 68, 68, 0.1)', label: 'Unstake' },
  claim: { color: 'var(--color-info)', bg: 'rgba(59, 130, 246, 0.1)', label: 'Claim' },
  compound: { color: 'var(--accent)', bg: 'var(--accent-muted)', label: 'Compound' },
  buy: { color: '#22c55e', bg: 'rgba(34, 197, 94, 0.1)', label: 'Buy' },
  sell: { color: '#ef4444', bg: 'rgba(239, 68, 68, 0.1)', label: 'Sell' },
  lp: { color: '#a855f7', bg: 'rgba(168, 85, 247, 0.1)', label: 'LP' },
  create: { color: '#3b82f6', bg: 'rgba(59, 130, 246, 0.1)', label: 'Create' },
  harvest: { color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.1)', label: 'Harvest' },
  approve: { color: 'var(--text-muted)', bg: 'rgba(148, 163, 184, 0.1)', label: 'Approve' },
};

function getAmountLabel(tx: Activity): string {
  switch (tx.type) {
    case 'buy':
      return `${formatNumber(tx.amount)} MOTO → ${tx.tokenSymbol ?? 'Token'}`;
    case 'sell':
      return `${formatNumber(tx.amount)} ${tx.tokenSymbol ?? 'Token'} → MOTO`;
    case 'lp':
      return `${formatNumber(tx.amount)} ${tx.tokenSymbol ?? 'Token'}${tx.motoAmount ? ` + ${formatNumber(tx.motoAmount)} MOTO` : ''}`;
    case 'create':
      return tx.tokenSymbol ?? 'New Token';
    case 'harvest':
      return tx.tokenSymbol ?? 'Harvest';
    case 'approve':
      return tx.tokenSymbol ?? 'Approve';
    case 'stake':
    case 'unstake':
      return `${formatNumber(tx.amount)} LP`;
    case 'claim':
    case 'compound':
      return `${formatNumber(tx.amount)} ${tx.tokenSymbol ?? 'ANCHOR'}`;
    default:
      return `${formatNumber(tx.amount)}`;
  }
}

interface TransactionHistoryProps {
  embedded?: boolean;
}

export function TransactionHistory({ embedded }: TransactionHistoryProps) {
  const { transactions } = useTransactionHistory();
  const { connected } = useWallet();

  const content = !connected ? (
    <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>
      Connect your wallet to view activity.
    </p>
  ) : transactions.length === 0 ? (
    <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>
      No activity yet. Interact with the protocol to see your history here.
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
      {transactions.map((tx, i) => {
        const style = TYPE_STYLES[tx.type] ?? TYPE_STYLES['stake']!;
        return (
          <motion.div
            key={tx.id}
            initial={{ opacity: 0, x: -12 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.06, duration: 0.3 }}
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
                    fontVariantNumeric: 'tabular-nums',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {getAmountLabel(tx)}
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
                  {tx.txHash.slice(0, 16)}...
                </div>
              </div>
            </div>
            <div style={{ textAlign: 'right', flexShrink: 0 }}>
              <div
                style={{
                  fontSize: 'var(--text-xs)',
                  color:
                    tx.status === 'confirmed'
                      ? 'var(--color-success)'
                      : tx.status === 'failed'
                        ? 'var(--color-error)'
                        : 'var(--color-warning)',
                  fontWeight: 500,
                }}
              >
                {tx.status === 'confirmed' ? 'Confirmed' : tx.status === 'pending' ? 'Pending' : 'Failed'}
              </div>
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                {formatTimeAgo(tx.timestamp)}
              </div>
            </div>
          </motion.div>
        );
      })}
    </div>
  );

  if (embedded) {
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
          Your Recent Activity
        </h3>
        {content}
      </>
    );
  }

  return (
    <Card delay={0.2}>
      <h3
        style={{
          fontFamily: 'var(--font-display)',
          fontSize: 'var(--text-lg)',
          fontWeight: 600,
          color: 'var(--text-primary)',
          marginBottom: 'var(--space-lg)',
        }}
      >
        Your Recent Activity
      </h3>
      {content}
    </Card>
  );
}
