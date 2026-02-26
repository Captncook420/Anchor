import { motion } from 'framer-motion';
import { Card } from '../common/Card';
import { useTransactionHistory } from '../../hooks/useTransactionHistory';
import { useWallet } from '../../hooks/useWallet';
import { formatNumber, formatTimeAgo } from '../../utils/format';

const TYPE_STYLES: Record<string, { color: string; bg: string; label: string }> = {
  stake: { color: 'var(--color-success)', bg: 'rgba(34, 197, 94, 0.1)', label: 'Stake' },
  unstake: { color: 'var(--color-error)', bg: 'rgba(239, 68, 68, 0.1)', label: 'Unstake' },
  claim: { color: 'var(--color-info)', bg: 'rgba(59, 130, 246, 0.1)', label: 'Claim' },
  compound: { color: 'var(--accent)', bg: 'var(--accent-muted)', label: 'Compound' },
};

export function TransactionHistory() {
  const { transactions } = useTransactionHistory();
  const { connected } = useWallet();

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
        Recent Activity
      </h3>

      {!connected ? (
        <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>
          Connect your wallet to view transaction history.
        </p>
      ) : transactions.length === 0 ? (
        <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>
          No transactions yet. Stake, claim, or compound to see activity here.
        </p>
      ) : (
        <div style={{ display: 'grid', gap: 'var(--space-sm)' }}>
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
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-md)' }}>
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
                  <div>
                    <div
                      style={{
                        fontFamily: 'var(--font-display)',
                        fontWeight: 600,
                        fontSize: 'var(--text-sm)',
                        color: 'var(--text-primary)',
                        fontVariantNumeric: 'tabular-nums',
                      }}
                    >
                      {formatNumber(tx.amount)} {tx.type === 'claim' || tx.type === 'compound' ? 'ANCHOR' : 'LP'}
                    </div>
                    <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                      {tx.txHash}
                    </div>
                  </div>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div
                    style={{
                      fontSize: 'var(--text-xs)',
                      color: tx.status === 'confirmed' ? 'var(--color-success)' : 'var(--color-warning)',
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
      )}
    </Card>
  );
}
