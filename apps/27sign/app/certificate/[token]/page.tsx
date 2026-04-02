import { query } from '@/lib/db'
import { notFound } from 'next/navigation'

export default async function CertificatePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params

  const { rows: srRows } = await query(
    `SELECT sr.*, s.image_data as signature_image, s.source as signature_source
     FROM signing_requests sr
     LEFT JOIN signatures s ON sr.signature_id = s.id
     WHERE sr.token = $1 AND sr.status = 'signed'`,
    [token]
  )
  if (srRows.length === 0) notFound()
  const sr = srRows[0]

  const { rows: auditRows } = await query(
    'SELECT action, ip, user_agent, created_at, entry_hash FROM audit_log WHERE signing_request_id = $1 ORDER BY created_at ASC',
    [sr.id]
  )

  const { rows: otpRows } = await query(
    'SELECT verified_at FROM otp_codes WHERE signing_request_id = $1 AND verified_at IS NOT NULL ORDER BY created_at DESC LIMIT 1',
    [sr.id]
  )

  const finalHash = auditRows.length > 0 ? auditRows[auditRows.length - 1].entry_hash : 'N/A'

  return (
    <>
      <style>{`
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: system-ui, -apple-system, sans-serif; color: #1a1a1a; background: #fff; }
        @media print {
          body { background: #fff; }
          .no-print { display: none !important; }
        }
        .container { max-width: 800px; margin: 0 auto; padding: 40px; }
        .header { background: #0a0a0a; color: #fff; padding: 40px; border-radius: 16px 16px 0 0; }
        .header h1 { font-size: 22px; font-weight: 700; margin-bottom: 4px; }
        .header p { font-size: 13px; opacity: 0.6; }
        .body { border: 1px solid #e5e5e5; border-top: none; border-radius: 0 0 16px 16px; }
        .section { padding: 28px 40px; border-bottom: 1px solid #e5e5e5; }
        .section:last-child { border-bottom: none; }
        .section-title { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; color: #999; margin-bottom: 12px; }
        .row { display: flex; gap: 40px; margin-bottom: 8px; }
        .label { font-size: 11px; font-weight: 600; color: #666; min-width: 120px; text-transform: uppercase; letter-spacing: 0.05em; }
        .value { font-size: 13px; font-weight: 500; color: #1a1a1a; }
        .sig-box { display: flex; align-items: center; justify-content: center; padding: 16px; border: 2px solid #e5e5e5; border-radius: 12px; background: #fafafa; }
        .sig-box img { max-height: 80px; }
        .audit-table { width: 100%; border-collapse: collapse; font-size: 11px; }
        .audit-table th { text-align: left; padding: 8px 12px; background: #f5f5f5; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; font-size: 10px; color: #666; }
        .audit-table td { padding: 8px 12px; border-bottom: 1px solid #f0f0f0; }
        .hash { font-family: monospace; font-size: 10px; color: #999; word-break: break-all; }
        .legal { font-size: 11px; color: #666; line-height: 1.6; }
        .badge { display: inline-block; padding: 2px 10px; border-radius: 99px; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; background: #22c55e; color: #fff; }
        .print-btn { position: fixed; bottom: 20px; right: 20px; padding: 12px 24px; background: #0a0a0a; color: #fff; border: none; border-radius: 99px; font-weight: 700; cursor: pointer; font-size: 13px; }
      `}</style>

      <div className="container">
        <button className="print-btn no-print" onClick={() => (typeof window !== 'undefined') && window.print()}>
          Print / Save PDF
        </button>

        <div className="header">
          <h1>Certificate of Completion</h1>
          <p>Relentify Digital Signing Service</p>
        </div>

        <div className="body">
          <div className="section">
            <div className="section-title">Document</div>
            <div className="row"><span className="label">Title</span><span className="value">{sr.title}</span></div>
            <div className="row"><span className="label">Status</span><span className="badge">Signed</span></div>
            <div className="row"><span className="label">Document Hash</span><span className="value hash">{sr.body_text_hash}</span></div>
          </div>

          <div className="section">
            <div className="section-title">Signer Details</div>
            <div className="row"><span className="label">Email</span><span className="value">{sr.signer_email}</span></div>
            {sr.signer_name && <div className="row"><span className="label">Name</span><span className="value">{sr.signer_name}</span></div>}
            <div className="row"><span className="label">IP Address</span><span className="value">{sr.signer_ip || 'N/A'}</span></div>
            <div className="row"><span className="label">Signed At</span><span className="value">{new Date(sr.signed_at).toLocaleString('en-GB', { dateStyle: 'full', timeStyle: 'long' })}</span></div>
            <div className="row"><span className="label">Signing Method</span><span className="value">{sr.signature_source === 'draw' ? 'Drawn on screen' : sr.signature_source === 'upload' ? 'Uploaded image' : 'Reused saved signature'}</span></div>
            {otpRows.length > 0 && (
              <div className="row"><span className="label">Email Verified</span><span className="value">{new Date(otpRows[0].verified_at).toLocaleString('en-GB')}</span></div>
            )}
          </div>

          {sr.signature_image && (
            <div className="section">
              <div className="section-title">Captured Signature</div>
              <div className="sig-box">
                <img src={sr.signature_image} alt="Digital signature" />
              </div>
            </div>
          )}

          <div className="section">
            <div className="section-title">Audit Trail</div>
            <table className="audit-table">
              <thead>
                <tr><th>Event</th><th>IP</th><th>Timestamp</th><th>Hash</th></tr>
              </thead>
              <tbody>
                {auditRows.map((entry: any) => (
                  <tr key={entry.created_at}>
                    <td style={{ fontWeight: 600 }}>{entry.action.replace(/_/g, ' ')}</td>
                    <td>{entry.ip || '—'}</td>
                    <td>{new Date(entry.created_at).toLocaleString('en-GB')}</td>
                    <td className="hash">{entry.entry_hash?.substring(0, 16)}...</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="section">
            <div className="section-title">Cryptographic Proof</div>
            <div className="row"><span className="label">Audit Chain Hash</span><span className="value hash">{finalHash}</span></div>
            <div className="row"><span className="label">Document Hash</span><span className="value hash">{sr.body_text_hash}</span></div>
          </div>

          <div className="section">
            <p className="legal">
              This document was signed electronically in compliance with the UK Electronic Communications Act 2000,
              EU eIDAS Regulation (Simple Electronic Signature), and US ESIGN Act. The signer's identity was verified
              via email OTP. All events are recorded in a tamper-evident hash-chained audit log with RFC 3161
              third-party timestamping.
            </p>
            <p className="legal" style={{ marginTop: 12 }}>
              Certificate generated {new Date().toLocaleString('en-GB')} by Relentify Sign.
            </p>
          </div>
        </div>
      </div>
    </>
  )
}
