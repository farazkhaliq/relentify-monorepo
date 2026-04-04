'use client';
import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Toaster, toast } from '@relentify/ui';

const inputCls = "w-full px-4 py-3 bg-[var(--theme-card)] border border-[var(--theme-border)] rounded-cinematic text-[var(--theme-text)] placeholder-[var(--theme-text-muted)] focus:ring-2 focus:ring-[var(--theme-accent)] focus:border-[var(--theme-accent)] outline-none transition-all text-sm";
const inputDisabledCls = "w-full px-4 py-3 bg-[var(--theme-card)] border border-[var(--theme-border)] rounded-cinematic text-[var(--theme-text-dim)] placeholder-[var(--theme-text-dim)] outline-none text-sm cursor-not-allowed";
const labelCls = "block text-[10px] font-black text-[var(--theme-text-muted)] uppercase tracking-widest mb-2";

export default function EditEntityPage() {
  const params = useParams();
  const id = params.id as string;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [tier, setTier] = useState<string>('free');
  const [f, setF] = useState({
    name: '',
    businessStructure: '',
    companyNumber: '',
    vatRegistered: false,
    vatNumber: '',
    currency: 'GBP',
    countryCode: 'GB',
    address: '',
    phone: '',
    website: '',
    logoUrl: '',
    brandColor: 'var(--theme-accent)',
    invoiceFooter: '',
  });

  useEffect(() => {
    async function load() {
      try {
        const [entityRes, meRes] = await Promise.all([
          fetch(`/api/entities/${id}`),
          fetch('/api/auth/me'),
        ]);
        const entityData = await entityRes.json();
        const meData = await meRes.json();

        if (!entityRes.ok) throw new Error(entityData.error || 'Failed to load entity');

        const e = entityData.entity;
        setF({
          name: e.name || '',
          businessStructure: e.business_structure || '',
          companyNumber: e.company_number || '',
          vatRegistered: e.vat_registered || false,
          vatNumber: e.vat_number || '',
          currency: e.currency || 'GBP',
          countryCode: e.country_code || 'GB',
          address: e.address || '',
          phone: e.phone || '',
          website: e.website || '',
          logoUrl: e.logo_url || '',
          brandColor: e.brand_color || 'var(--theme-accent)',
          invoiceFooter: e.invoice_footer || '',
        });
        setTier(meData.user?.subscription_plan || 'free');
      } catch (e: unknown) {
        toast(e instanceof Error ? e.message : 'Failed to load entity', 'error');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id]);

  function uf(k: string, v: string | boolean) { setF(p => ({ ...p, [k]: v })); }

  const hasBranding = tier === 'medium_business' || tier === 'enterprise';

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        name: f.name,
        businessStructure: f.businessStructure || undefined,
        companyNumber: f.companyNumber || undefined,
        vatRegistered: f.vatRegistered,
        vatNumber: f.vatNumber || undefined,
        currency: f.currency,
        countryCode: f.countryCode,
        address: f.address || undefined,
        phone: f.phone || undefined,
        website: f.website || undefined,
      };
      if (hasBranding) {
        body.logoUrl = f.logoUrl || undefined;
        body.brandColor = f.brandColor || undefined;
        body.invoiceFooter = f.invoiceFooter || undefined;
      }
      const r = await fetch(`/api/entities/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      toast('Entity saved', 'success');
    } catch (e: unknown) {
      toast(e instanceof Error ? e.message : 'Failed to save entity', 'error');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--theme-background)] bg-transparent">
        <main className="max-w-2xl mx-auto px-4 sm:px-6 py-8 sm:py-10">
          <div className="text-[var(--theme-text-muted)] text-sm">Loading...</div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--theme-background)] bg-transparent">
      <Toaster />
      <main className="max-w-2xl mx-auto px-4 sm:px-6 py-8 sm:py-10">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-2xl font-black text-[var(--theme-text)] tracking-tight">Edit Entity</h1>
          <Link href="/dashboard/entities" className="text-[10px] font-black text-[var(--theme-text-muted)] uppercase tracking-widest hover:text-[var(--theme-text)] no-underline">← Back</Link>
        </div>

        <form onSubmit={onSubmit} className="space-y-6">
          {/* Business Details */}
          <div className="bg-[var(--theme-card)] border border-[var(--theme-border)] rounded-cinematic p-5 sm:p-8 space-y-4">
            <h2 className="text-[10px] font-black text-[var(--theme-accent)] uppercase tracking-widest">Business Details</h2>

            <div>
              <label className={labelCls}>Entity Name *</label>
              <input type="text" required value={f.name} onChange={e => uf('name', e.target.value)} className={inputCls} placeholder="e.g. Acme Ltd" />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>Business Structure</label>
                <select value={f.businessStructure} onChange={e => uf('businessStructure', e.target.value)} className={inputCls + ' appearance-none bg-[var(--theme-card)]'}>
                  <option value="">Select...</option>
                  <option value="sole_trader">Sole Trader</option>
                  <option value="limited_company">Limited Company</option>
                  <option value="llp">LLP</option>
                  <option value="partnership">Partnership</option>
                </select>
              </div>
              <div>
                <label className={labelCls}>Company Number</label>
                <input type="text" value={f.companyNumber} onChange={e => uf('companyNumber', e.target.value)} className={inputCls} placeholder="e.g. 12345678" />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>Currency</label>
                <select value={f.currency} onChange={e => uf('currency', e.target.value)} className={inputCls + ' appearance-none bg-[var(--theme-card)]'}>
                  <option value="GBP">GBP (£)</option>
                  <option value="USD">USD ($)</option>
                  <option value="EUR">EUR (€)</option>
                  <option value="CAD">CAD (CA$)</option>
                  <option value="AUD">AUD (A$)</option>
                  <option value="NZD">NZD (NZ$)</option>
                </select>
              </div>
              <div>
                <label className={labelCls}>Country</label>
                <select value={f.countryCode} onChange={e => uf('countryCode', e.target.value)} className={inputCls + ' appearance-none bg-[var(--theme-card)]'}>
                  <option value="GB">United Kingdom</option>
                  <option value="US">United States</option>
                  <option value="IE">Ireland</option>
                  <option value="AU">Australia</option>
                  <option value="NZ">New Zealand</option>
                  <option value="CA">Canada</option>
                </select>
              </div>
            </div>

            <div>
              <label className={labelCls}>Address</label>
              <textarea value={f.address} onChange={e => uf('address', e.target.value)} rows={2} className={inputCls} placeholder="Business address" />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>Phone</label>
                <input type="text" value={f.phone} onChange={e => uf('phone', e.target.value)} className={inputCls} placeholder="e.g. +44 20 1234 5678" />
              </div>
              <div>
                <label className={labelCls}>Website</label>
                <input type="text" value={f.website} onChange={e => uf('website', e.target.value)} className={inputCls} placeholder="e.g. https://acme.co.uk" />
              </div>
            </div>
          </div>

          {/* VAT */}
          <div className="bg-[var(--theme-card)] border border-[var(--theme-border)] rounded-cinematic p-5 sm:p-8 space-y-4">
            <h2 className="text-[10px] font-black text-[var(--theme-accent)] uppercase tracking-widest">VAT</h2>
            <label className="flex items-center gap-3 cursor-pointer">
              <input type="checkbox" checked={f.vatRegistered} onChange={e => uf('vatRegistered', e.target.checked)} className="w-4 h-4 rounded accent-[var(--theme-accent)]" />
              <span className="text-sm font-bold text-[var(--theme-text-muted)]">VAT Registered</span>
            </label>
            {f.vatRegistered && (
              <div>
                <label className={labelCls}>VAT Number</label>
                <input type="text" value={f.vatNumber} onChange={e => uf('vatNumber', e.target.value)} className={inputCls} placeholder="e.g. GB123456789" />
              </div>
            )}
          </div>

          {/* Invoice Branding */}
          <div className="bg-[var(--theme-card)] border border-[var(--theme-border)] rounded-cinematic p-5 sm:p-8 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-[10px] font-black text-[var(--theme-accent)] uppercase tracking-widest">Invoice Branding</h2>
              {!hasBranding && (
                <span className="text-[10px] font-black text-[var(--theme-warning)] uppercase tracking-widest">Medium Business+</span>
              )}
            </div>

            {!hasBranding && (
              <div className="bg-[var(--theme-warning)]/10 border border-[var(--theme-warning)]/20 rounded-cinematic p-4">
                <p className="text-xs text-[var(--theme-warning)] font-medium">
                  Custom branding is available on the Medium Business plan and above. Upgrade to add your logo, brand colour, and custom footer to client invoices.
                </p>
              </div>
            )}

            <div>
              <label className={labelCls}>Logo URL</label>
              <input
                type="text"
                value={f.logoUrl}
                onChange={e => uf('logoUrl', e.target.value)}
                className={hasBranding ? inputCls : inputDisabledCls}
                disabled={!hasBranding}
                placeholder="https://example.com/logo.png"
              />
              {hasBranding && f.logoUrl && (
                <div className="mt-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={f.logoUrl} alt="Logo preview" className="max-h-16 rounded-lg border border-[var(--theme-border)]" onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                </div>
              )}
            </div>

            <div>
              <label className={labelCls}>Brand Colour</label>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  value={f.brandColor}
                  onChange={e => uf('brandColor', e.target.value)}
                  disabled={!hasBranding}
                  className="w-10 h-10 rounded-lg border border-[var(--theme-border)] cursor-pointer disabled:cursor-not-allowed disabled:opacity-40"
                />
                <input
                  type="text"
                  value={f.brandColor}
                  onChange={e => uf('brandColor', e.target.value)}
                  className={hasBranding ? inputCls + ' flex-1' : inputDisabledCls + ' flex-1'}
                  disabled={!hasBranding}
                  placeholder="var(--theme-accent)"
                  maxLength={7}
                />
              </div>
            </div>

            <div>
              <label className={labelCls}>Invoice Footer</label>
              <textarea
                value={f.invoiceFooter}
                onChange={e => uf('invoiceFooter', e.target.value)}
                rows={2}
                className={hasBranding ? inputCls : inputDisabledCls}
                disabled={!hasBranding}
                placeholder="e.g. Thank you for your business! Payment terms: 30 days."
              />
              <p className="text-[10px] text-[var(--theme-text-dim)] mt-1">Replaces &quot;Sent via Relentify&quot; in invoice emails.</p>
            </div>
          </div>

          <button
            type="submit" disabled={saving}
            className="w-full py-4 bg-[var(--theme-accent)] text-white font-black rounded-cinematic text-sm uppercase tracking-widest hover:brightness-110 disabled:opacity-50 transition-all shadow-lg active:scale-[0.98]"
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </form>
      </main>
    </div>
  );
}
