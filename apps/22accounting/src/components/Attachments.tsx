'use client';
import { useEffect, useRef, useState } from 'react';
import { toast } from '@relentify/ui';

type RecordType = 'bill' | 'expense' | 'mileage' | 'bank_transaction';

interface Attachment {
  id: string;
  file_name: string;
  file_size: number | null;
  mime_type: string | null;
  url: string;
  created_at: string;
}

interface Props {
  recordType: RecordType;
  recordId: string;
}

function formatBytes(bytes: number | null): string {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

function FileIcon({ mimeType }: { mimeType: string | null }) {
  const isPdf = mimeType === 'application/pdf';
  return (
    <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 text-[9px] font-black uppercase tracking-widest ${isPdf ? 'bg-[var(--theme-destructive)]/10 text-[var(--theme-destructive)]' : 'bg-[var(--theme-accent)]/10 text-[var(--theme-accent)]'}`}>
      {isPdf ? 'PDF' : 'IMG'}
    </div>
  );
}

export default function Attachments({ recordType, recordId }: Props) {
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => { load(); }, [recordType, recordId]);

  async function load() {
    setLoading(true);
    try {
      const r = await fetch(`/api/attachments?recordType=${recordType}&recordId=${recordId}`);
      const d = await r.json();
      if (d.attachments) setAttachments(d.attachments);
    } catch { /* silently ignore — not critical */ }
    finally { setLoading(false); }
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const form = new FormData();
      form.append('file', file);
      form.append('recordType', recordType);
      form.append('recordId', recordId);
      const r = await fetch('/api/attachments', { method: 'POST', body: form });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Upload failed');
      setAttachments(prev => [...prev, d.attachment]);
      toast('Attachment uploaded', 'success');
    } catch (err: unknown) {
      toast(err instanceof Error ? err.message : 'Upload failed', 'error');
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  async function handleDelete(id: string, fileName: string) {
    if (!confirm(`Delete "${fileName}"?`)) return;
    try {
      const r = await fetch(`/api/attachments/${id}`, { method: 'DELETE' });
      if (!r.ok) throw new Error('Failed to delete');
      setAttachments(prev => prev.filter(a => a.id !== id));
      toast('Attachment deleted', 'success');
    } catch { toast('Failed to delete attachment', 'error'); }
  }

  const labelCls = 'text-[10px] font-black text-[var(--theme-text-muted)] uppercase tracking-widest block mb-3';

  return (
    <div className="mt-6 pt-6 border-t border-[var(--theme-border)]">
      <span className={labelCls}>Attachments</span>

      {loading ? (
        <div className="text-[var(--theme-text-muted)] text-sm">Loading...</div>
      ) : (
        <>
          {attachments.length > 0 && (
            <ul className="space-y-2 mb-4">
              {attachments.map(a => (
                <li key={a.id} className="flex items-center gap-3 bg-[var(--theme-card)] border border-[var(--theme-border)] rounded-xl px-4 py-3">
                  <FileIcon mimeType={a.mime_type} />
                  <div className="flex-1 min-w-0">
                    <a
                      href={a.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm font-semibold text-[var(--theme-text)] hover:text-[var(--theme-accent)] truncate block no-underline"
                    >
                      {a.file_name}
                    </a>
                    {a.file_size && (
                      <span className="text-[10px] text-[var(--theme-text-muted)]">{formatBytes(a.file_size)}</span>
                    )}
                  </div>
                  <button
                    onClick={() => handleDelete(a.id, a.file_name)}
                    className="text-[var(--theme-text-muted)] hover:text-[var(--theme-destructive)] transition-colors text-lg leading-none bg-transparent border-none cursor-pointer shrink-0"
                    title="Delete"
                  >✕</button>
                </li>
              ))}
            </ul>
          )}

          <input
            ref={fileRef}
            type="file"
            accept=".pdf,.jpg,.jpeg,.png,.webp"
            className="hidden"
            onChange={handleFileChange}
          />
          <button
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-[var(--theme-card)] border border-[var(--theme-border)] text-[var(--theme-text-muted)] hover:text-[var(--theme-text)] hover:bg-[var(--theme-border)]/30 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all disabled:opacity-50 cursor-pointer"
          >
            {uploading ? (
              <>
                <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Uploading...
              </>
            ) : (
              <>
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                </svg>
                Attach Receipt
              </>
            )}
          </button>
        </>
      )}
    </div>
  );
}
