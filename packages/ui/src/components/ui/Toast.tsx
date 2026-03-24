'use client';
import { useEffect, useState } from 'react';
import { cn } from '../../lib/utils';
import { Check, X, Info } from 'lucide-react';

type ToastType = 'success' | 'error' | 'info';
interface ToastItem { id: number; message: string; type: ToastType; }

let _id = 0;
let _set: ((fn: (prev: ToastItem[]) => ToastItem[]) => void) | null = null;

export function toast(message: string, type: ToastType = 'success') {
  if (!_set) return;
  const id = ++_id;
  _set(prev => [...prev, { id, message, type }]);
  setTimeout(() => _set?.(prev => prev.filter(t => t.id !== id)), 3500);
}

export function Toaster() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  useEffect(() => { _set = setToasts; return () => { _set = null; }; }, []);
  if (!toasts.length) return null;

  return (
    <div className="fixed bottom-12 right-12 z-[100] flex flex-col gap-4 pointer-events-none">
      {toasts.map(t => (
        <div 
          key={t.id} 
          className={cn(
            "flex items-center gap-4 px-6 py-4 rounded-3xl shadow-cinematic border backdrop-blur-3xl transition-all animate-in slide-in-from-right-10 duration-500",
            t.type === 'success' ? 'bg-[var(--theme-accent)]/10 border-[var(--theme-accent)]/20 text-[var(--theme-accent)]' :
            t.type === 'error'   ? 'bg-red-500/10 border-red-500/20 text-red-500' :
                                 'bg-blue-500/10 border-blue-500/20 text-blue-500'
          )}
        >
          <div className={cn(
            "flex h-8 w-8 items-center justify-center rounded-full shadow-sm",
            t.type === 'success' ? 'bg-[var(--theme-accent)] text-white' :
            t.type === 'error'   ? 'bg-red-500 text-white' :
                                 'bg-blue-500 text-white'
          )}>
            {t.type === 'success' ? <Check className="h-4 w-4" /> : t.type === 'error' ? <X className="h-4 w-4" /> : <Info className="h-4 w-4" />}
          </div>
          <span className="text-base font-medium tracking-tight">{t.message}</span>
        </div>
      ))}
    </div>
  );
}
