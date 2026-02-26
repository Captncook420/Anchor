import { useState, useEffect, useCallback, createContext, useContext, type ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { ToastMessage } from '../../types';

interface ToastContextType {
  addToast: (toast: Omit<ToastMessage, 'id'>) => void;
}

const ToastContext = createContext<ToastContextType>({ addToast: () => {} });

export function useToast() {
  return useContext(ToastContext);
}

function ToastItem({ toast, onRemove }: { toast: ToastMessage; onRemove: (id: string) => void }) {
  const duration = toast.duration ?? 4000;

  useEffect(() => {
    const timer = setTimeout(() => onRemove(toast.id), duration);
    return () => clearTimeout(timer);
  }, [toast.id, duration, onRemove]);

  const colors: Record<string, string> = {
    success: 'var(--color-success)',
    error: 'var(--color-error)',
    warning: 'var(--color-warning)',
    info: 'var(--color-info)',
  };

  const borderColor = colors[toast.type] ?? colors.info;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: 80, scale: 0.9 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: 80, scale: 0.9 }}
      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
      style={{
        background: 'var(--surface-card)',
        border: '1px solid var(--border-subtle)',
        borderLeft: `3px solid ${borderColor}`,
        borderRadius: 'var(--radius-md)',
        padding: 'var(--space-md)',
        minWidth: 300,
        maxWidth: 400,
        boxShadow: 'var(--shadow-lg)',
        backdropFilter: 'blur(12px)',
      }}
    >
      <div
        style={{
          fontFamily: 'var(--font-display)',
          fontWeight: 600,
          fontSize: 'var(--text-sm)',
          color: 'var(--text-primary)',
          marginBottom: 'var(--space-xs)',
        }}
      >
        {toast.title}
      </div>
      <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>
        {toast.message}
      </div>
      <div
        style={{
          marginTop: 'var(--space-sm)',
          height: 2,
          background: 'var(--surface-interactive)',
          borderRadius: 'var(--radius-full)',
          overflow: 'hidden',
        }}
      >
        <motion.div
          initial={{ width: '100%' }}
          animate={{ width: '0%' }}
          transition={{ duration: duration / 1000, ease: 'linear' }}
          style={{
            height: '100%',
            background: borderColor,
            borderRadius: 'var(--radius-full)',
          }}
        />
      </div>
    </motion.div>
  );
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const addToast = useCallback((toast: Omit<ToastMessage, 'id'>) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    setToasts((prev) => [...prev, { ...toast, id }]);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ addToast }}>
      {children}
      <div
        style={{
          position: 'fixed',
          top: 'var(--space-lg)',
          right: 'var(--space-lg)',
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--space-sm)',
          zIndex: 'var(--z-toast)',
          pointerEvents: 'none',
        }}
      >
        <AnimatePresence mode="popLayout">
          {toasts.map((toast) => (
            <div key={toast.id} style={{ pointerEvents: 'auto' }}>
              <ToastItem toast={toast} onRemove={removeToast} />
            </div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}
