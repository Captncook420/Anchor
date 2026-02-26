import { type ReactNode } from 'react';
import { motion } from 'framer-motion';

interface Tab {
  id: string;
  label: string;
}

interface TabGroupProps {
  tabs: Tab[];
  activeTab: string;
  onChange: (id: string) => void;
  children?: ReactNode;
}

export function TabGroup({ tabs, activeTab, onChange }: TabGroupProps) {
  return (
    <div
      style={{
        display: 'flex',
        gap: 'var(--space-xs)',
        padding: 'var(--space-xs)',
        background: 'var(--surface-raised)',
        borderRadius: 'var(--radius-lg)',
        border: '1px solid var(--border-subtle)',
        position: 'relative',
      }}
    >
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onChange(tab.id)}
          style={{
            position: 'relative',
            flex: 1,
            padding: '10px 20px',
            fontSize: 'var(--text-sm)',
            fontFamily: 'var(--font-display)',
            fontWeight: 600,
            color: activeTab === tab.id ? '#0a0a0f' : 'var(--text-secondary)',
            background: 'none',
            border: 'none',
            borderRadius: 'var(--radius-md)',
            cursor: 'pointer',
            zIndex: 1,
            transition: 'color var(--duration-fast) var(--ease-out)',
          }}
        >
          {activeTab === tab.id && (
            <motion.div
              layoutId="tab-indicator"
              style={{
                position: 'absolute',
                inset: 0,
                background: 'linear-gradient(135deg, var(--accent) 0%, #e8850f 100%)',
                borderRadius: 'var(--radius-md)',
                zIndex: -1,
                boxShadow: '0 2px 8px var(--accent-glow)',
              }}
              transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            />
          )}
          {tab.label}
        </button>
      ))}
    </div>
  );
}
