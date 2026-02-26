import { motion } from 'framer-motion';

const NODES = [
  { id: 'factory', label: 'Factory', x: 250, y: 40 },
  { id: 'child', label: 'Child Tokens', x: 430, y: 150 },
  { id: 'fee', label: '1% Platform Fee', x: 400, y: 310 },
  { id: 'buy', label: 'Buy ANCHOR', x: 200, y: 380 },
  { id: 'burn', label: 'LP Burn', x: 60, y: 280 },
  { id: 'rewards', label: 'Staker Rewards', x: 70, y: 130 },
];

const EDGES = [
  { from: 0, to: 1 },
  { from: 1, to: 2 },
  { from: 2, to: 3 },
  { from: 3, to: 4 },
  { from: 4, to: 5 },
  { from: 5, to: 0 },
];

export function FlywheelDiagram() {
  return (
    <motion.section
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-60px' }}
      transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      style={{
        padding: 'var(--space-3xl) 0',
        textAlign: 'center',
      }}
    >
      <h2
        style={{
          fontFamily: 'var(--font-display)',
          fontSize: 'var(--text-3xl)',
          fontWeight: 700,
          color: 'var(--text-primary)',
          marginBottom: 'var(--space-sm)',
        }}
      >
        The ANCHOR Flywheel
      </h2>
      <p
        style={{
          fontSize: 'var(--text-base)',
          color: 'var(--text-secondary)',
          maxWidth: '48ch',
          margin: '0 auto var(--space-2xl)',
        }}
      >
        Every child token launch strengthens the protocol. A self-reinforcing cycle of value creation.
      </p>

      <div
        style={{
          maxWidth: 520,
          margin: '0 auto',
          position: 'relative',
        }}
      >
        <svg
          viewBox="0 0 500 430"
          style={{ width: '100%', height: 'auto' }}
        >
          <defs>
            <filter id="glow">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            <linearGradient id="edgeGrad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#F7931A" stopOpacity="0.6" />
              <stop offset="100%" stopColor="#F7931A" stopOpacity="0.2" />
            </linearGradient>
          </defs>

          {/* Edges */}
          {EDGES.map((edge, i) => {
            const from = NODES[edge.from]!;
            const to = NODES[edge.to]!;
            return (
              <motion.line
                key={`edge-${i}`}
                x1={from.x}
                y1={from.y}
                x2={to.x}
                y2={to.y}
                stroke="url(#edgeGrad)"
                strokeWidth="1.5"
                strokeDasharray="6 4"
                initial={{ pathLength: 0, opacity: 0 }}
                whileInView={{ pathLength: 1, opacity: 1 }}
                viewport={{ once: true }}
                transition={{ delay: 0.3 + i * 0.15, duration: 0.6 }}
              />
            );
          })}

          {/* Flow dots */}
          {EDGES.map((edge, i) => {
            const from = NODES[edge.from]!;
            const to = NODES[edge.to]!;
            return (
              <motion.circle
                key={`dot-${i}`}
                r="3"
                fill="#F7931A"
                filter="url(#glow)"
                initial={{ opacity: 0 }}
                whileInView={{ opacity: 1 }}
                viewport={{ once: true }}
                transition={{ delay: 0.8 + i * 0.15 }}
              >
                <animateMotion
                  dur={`${2 + i * 0.3}s`}
                  repeatCount="indefinite"
                  path={`M${from.x},${from.y} L${to.x},${to.y}`}
                  begin={`${i * 0.4}s`}
                />
              </motion.circle>
            );
          })}

          {/* Nodes */}
          {NODES.map((node, i) => (
            <motion.g
              key={node.id}
              initial={{ opacity: 0, scale: 0.8 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ delay: 0.15 * i, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
            >
              <circle
                cx={node.x}
                cy={node.y}
                r="36"
                fill="rgba(20, 20, 31, 0.9)"
                stroke="#F7931A"
                strokeWidth="1.5"
                opacity="0.9"
              />
              <circle
                cx={node.x}
                cy={node.y}
                r="36"
                fill="none"
                stroke="#F7931A"
                strokeWidth="1.5"
                opacity="0.3"
                filter="url(#glow)"
              >
                <animate
                  attributeName="r"
                  values="36;40;36"
                  dur="3s"
                  repeatCount="indefinite"
                  begin={`${i * 0.5}s`}
                />
                <animate
                  attributeName="opacity"
                  values="0.3;0.1;0.3"
                  dur="3s"
                  repeatCount="indefinite"
                  begin={`${i * 0.5}s`}
                />
              </circle>
              <text
                x={node.x}
                y={node.y}
                textAnchor="middle"
                dominantBaseline="central"
                fill="#E8E8ED"
                fontSize="10"
                fontFamily="Space Grotesk, sans-serif"
                fontWeight="600"
              >
                {node.label.split(' ').map((word, wi) => (
                  <tspan
                    key={wi}
                    x={node.x}
                    dy={wi === 0 ? (node.label.includes(' ') ? '-0.4em' : '0') : '1.1em'}
                  >
                    {word}
                  </tspan>
                ))}
              </text>
            </motion.g>
          ))}
        </svg>
      </div>
    </motion.section>
  );
}
