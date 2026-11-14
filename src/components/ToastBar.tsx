import { X, CheckCircle2, AlertTriangle, Info, XCircle } from 'lucide-react';
import type { ToastNotice } from '../hooks/useLeagueRealtime';

export function ToastBar({
  toasts,
  onDismiss,
}: {
  toasts: ToastNotice[];
  onDismiss: (id: string) => void;
}) {
  if (!toasts.length) return null;

  return (
    <div className="fixed top-16 right-4 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none px-4 sm:px-0">
      {toasts.map((t) => {
        const icon =
          t.tone === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-[#4ADE80] shrink-0" />
          ) : t.tone === 'warning' ? (
            <AlertTriangle className="w-4 h-4 text-[#EAB308] shrink-0" />
          ) : t.tone === 'error' ? (
            <XCircle className="w-4 h-4 text-rose-400 shrink-0" />
          ) : (
            <Info className="w-4 h-4 text-[#93E6EE] shrink-0" />
          );

        return (
          <div
            key={t.id}
            className="cm27-toast-in pointer-events-auto flex items-start gap-3 bg-[#151A22]/95 border border-white/15 border-b-black/60 rounded-md px-4 py-3 shadow-[0_12px_28px_rgba(0,0,0,0.65),inset_0_1px_0_rgba(255,255,255,0.08)] backdrop-blur-md"
          >
            <div className="mt-0.5">{icon}</div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-white truncate">{t.title}</p>
              {t.body && <p className="text-xs text-slate-300 mt-0.5 line-clamp-2">{t.body}</p>}
            </div>
            <button
              onClick={() => onDismiss(t.id)}
              className="text-slate-400 hover:text-white p-0.5 cursor-pointer"
              aria-label="Dismiss notification"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
