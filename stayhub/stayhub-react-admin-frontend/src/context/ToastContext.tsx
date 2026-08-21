import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react'

type Tone = 'success' | 'error' | 'info'
interface Toast { id: number; message: string; tone: Tone }

const ToastContext = createContext<{ toast: (m: string, t?: Tone) => void } | null>(null)

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const nextId = useRef(1)

  const toast = useCallback((message: string, tone: Tone = 'info') => {
    const id = nextId.current++
    setToasts((c) => [...c, { id, message, tone }])
    window.setTimeout(() => setToasts((c) => c.filter((t) => t.id !== id)), 5000)
  }, [])

  const value = useMemo(() => ({ toast }), [toast])

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        className="pointer-events-none fixed bottom-6 right-6 z-50 flex w-full max-w-sm flex-col gap-2"
        role="status"
        aria-live="polite"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            className={[
              'pointer-events-auto rounded-lg px-4 py-3 text-sm font-medium shadow-lg ring-1',
              t.tone === 'success' && 'bg-emerald-50 text-emerald-900 ring-emerald-200',
              t.tone === 'error' && 'bg-red-50 text-red-900 ring-red-200',
              t.tone === 'info' && 'bg-ink-900 text-white ring-ink-800',
            ]
              .filter(Boolean)
              .join(' ')}
          >
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>')
  return ctx
}
