import {
  createContext, useContext, useState, useCallback, type ReactNode,
} from 'react';

type ToastType = 'success' | 'error' | 'info';

interface Toast { id: number; type: ToastType; message: string; }

interface ToastCtx { toast: (message: string, type?: ToastType) => void; }

const ToastContext = createContext<ToastCtx>(null!);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  let _id = 0;

  const toast = useCallback((message: string, type: ToastType = 'info') => {
    const id = ++_id;
    setToasts(t => [...t, { id, type, message }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 4000);
  }, []);

  const icon = (t: ToastType) => t === 'success' ? '✓' : t === 'error' ? '✕' : 'ℹ';

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="toast-container">
        {toasts.map(t => (
          <div key={t.id} className={`toast toast-${t.type}`}>
            <span style={{ fontSize: '1rem' }}>{icon(t.type)}</span>
            <span>{t.message}</span>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);
