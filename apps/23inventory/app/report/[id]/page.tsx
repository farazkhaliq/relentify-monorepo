import { query } from '@/lib/db'
import { toInventory, toPhoto, InventoryWithPhotos } from '@/lib/types'
import { getAuthUser } from '@/lib/auth'
import { notFound, redirect } from 'next/navigation'
import PrintButton from '@/components/PrintButton'

export const dynamic = 'force-dynamic'

const CONDITIONS: Record<string, string> = { 
  Good: 'var(--theme-success)', 
  Fair: 'var(--theme-warning)', 
  Poor: 'var(--theme-destructive)' 
}

export default async function ReportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await getAuthUser()
  if (!user) redirect('https://login.relentify.com/login')

  const { rows: invRows } = await query(
    'SELECT * FROM inv_items WHERE id=$1 AND user_id=$2',
    [id, user.userId]
  )
  if (!invRows.length) notFound()
  const { rows: photoRows } = await query(
    'SELECT * FROM inv_photos WHERE inventory_id=$1 ORDER BY room ASC, uploaded_at ASC',
    [id]
  )
  const inventory: InventoryWithPhotos = {
    ...toInventory(invRows[0]),
    photos: photoRows.map(toPhoto),
  }

  const rooms = Array.from(new Set(inventory.photos.map(p => p.room)))
  const byRoom = rooms.reduce((acc, room) => {
    acc[room] = inventory.photos.filter(p => p.room === room)
    return acc
  }, {} as Record<string, typeof inventory.photos>)

  const getImageSrc = (photo: typeof inventory.photos[0]) => {
    return photo.imageData || ''
  }

  return (
    <>
      <style>{`
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: var(--font-sans); color: var(--theme-text); background: var(--theme-background); }
        @media print { body { background: white; } }
        .topbar { background: var(--theme-background); padding: 10px 40px; display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid var(--theme-border); }
        .topbar span { font-size: var(--theme-text-80); color: var(--theme-text-muted); }
        .header { background: var(--theme-primary); color: var(--theme-text); padding: 32px 40px; }
        .header h1 { font-size: 20px; font-weight: 700; margin-bottom: 4px; }
        .header p { font-size: var(--theme-text-80); color: var(--theme-text-dim); opacity: 0.8; }
        .meta { display: grid; grid-template-columns: repeat(4, 1fr); border-bottom: 1px solid var(--theme-border); }
        .meta-item { padding: 18px 32px; border-right: 1px solid var(--theme-border); }
        .meta-item:last-child { border-right: none; }
        .meta-label { font-size: var(--theme-text-10); font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; color: var(--theme-text-muted); margin-bottom: 4px; }
        .meta-value { font-size: var(--theme-text-80); font-weight: 600; color: var(--theme-text); }
        
        /* Specialized print-safe badges */
        .print-badge { display: inline-block; padding: 2px 8px; border-radius: 99px; font-size: var(--theme-text-70); font-weight: 500; }
        .badge-in { background: var(--theme-success); color: var(--theme-text); }
        .badge-out { background: var(--theme-warning); color: var(--theme-text); }
        .badge-conf { background: var(--theme-accent); color: var(--theme-text); }
        
        .notes-bar { padding: 14px 32px; background: var(--theme-background); border-bottom: 1px solid var(--theme-border); font-size: var(--theme-text-80); color: var(--theme-text-muted); }
        .notes-label { font-size: var(--theme-text-9); font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; color: var(--theme-text-dim); margin-bottom: 3px; }
        .room { padding: 28px 32px; border-bottom: 1px solid var(--theme-border); }
        .room-title { font-size: 15px; font-weight: 700; padding-bottom: 12px; border-bottom: 2px solid var(--theme-border); margin-bottom: 16px; color: var(--theme-text); }
        .room-count { font-weight: 400; color: var(--theme-text-muted); font-size: var(--theme-text-80); }
        .grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; }
        .card { border: 1px solid var(--theme-border); border-radius: 8px; overflow: hidden; }
        .card img { width: 100%; height: 175px; object-fit: cover; display: block; }
        .card-meta { padding: 8px 10px; }
        .cond { font-size: var(--theme-text-70); font-weight: 700; }
        .desc { font-size: var(--theme-text-10); color: var(--theme-text-muted); margin-top: 2px; }
        .time { font-size: var(--theme-text-10); color: var(--theme-text-dim); margin-top: 2px; }
        .sigs { padding: 32px; display: grid; grid-template-columns: 1fr 1fr; gap: 48px; }
        .sig-box { border-top: 1px solid var(--theme-text); padding-top: 8px; font-size: var(--theme-text-70); color: var(--theme-text-muted); }
        .footer { padding: 20px 32px; background: var(--theme-background); border-top: 1px solid var(--theme-border); display: flex; justify-content: space-between; font-size: var(--theme-text-70); color: var(--theme-text-dim); }
        .confirm-note { padding: 0 32px 16px; font-size: var(--theme-text-70); color: var(--theme-text-muted); }
        @media print {
          .topbar { display: none; }
          .room { page-break-inside: avoid; }
          .card { page-break-inside: avoid; }
        }
      `}</style>

      <div className="topbar">
        <span>Preview — use Print to save as PDF (Ctrl+P / Cmd+P)</span>
        <PrintButton />
      </div>
      <div className="header">
        <h1>{inventory.propertyAddress}</h1>
        <p>Property Inventory Report · {new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
      </div>
      <div className="meta">
        <div className="meta-item">
          <div className="meta-label">Type</div>
          <div className="meta-value">
            <span className={`print-badge ${inventory.type === 'check-in' ? 'badge-in' : 'badge-out'}`}>
              {inventory.type === 'check-in' ? 'Check-In' : 'Check-Out'}
            </span>
          </div>
        </div>
        <div className="meta-item">
          <div className="meta-label">Agent</div>
          <div className="meta-value">{inventory.createdBy}</div>
        </div>
        <div className="meta-item">
          <div className="meta-label">Date</div>
          <div className="meta-value">{new Date(inventory.createdAt).toLocaleDateString('en-GB')}</div>
        </div>
        <div className="meta-item">
          <div className="meta-label">Status</div>
          <div className="meta-value">
            {inventory.tenantConfirmed
              ? <span className="print-badge badge-conf">Confirmed</span>
              : <span style={{color:'var(--theme-text-dim)', fontSize:'var(--theme-text-75)'}}>Pending</span>}
          </div>
        </div>
      </div>
      {inventory.notes && (
        <div className="notes-bar">
          <div className="notes-label">Notes</div>
          {inventory.notes}
        </div>
      )}
      {rooms.length === 0 ? (
        <div style={{padding:'48px 32px', textAlign:'center', color:'var(--theme-text-dim)', fontSize:'var(--theme-text-80)'}}>
          No photos have been added to this inventory.
        </div>
      ) : rooms.map(room => (
        <div key={room} className="room">
          <div className="room-title">
            {room} <span className="room-count">({byRoom[room].length} photo{byRoom[room].length !== 1 ? 's' : ''})</span>
          </div>
          <div className="grid">
            {byRoom[room].map(photo => (
              <div key={photo.id} className="card">
                <img src={getImageSrc(photo)} alt={photo.description || room} />
                <div className="card-meta">
                  <div className="cond" style={{color: CONDITIONS[photo.condition] || CONDITIONS.Good}}>● {photo.condition}</div>
                  {photo.description && <div className="desc">{photo.description}</div>}
                  <div className="time">{new Date(photo.uploadedAt).toLocaleTimeString('en-GB', {hour:'2-digit',minute:'2-digit'})}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
      <div className="sigs">
        <div><div className="sig-box">Agent Signature · {inventory.createdBy}</div></div>
        <div>
          <div className="sig-box">
            Tenant Signature
            {inventory.tenantSignatureData && (
              <img src={inventory.tenantSignatureData} alt="Tenant signature" style={{maxHeight: '80px', marginTop: '8px'}} />
            )}
          </div>
        </div>
      </div>
      {inventory.tenantConfirmed && inventory.confirmedAt && (
        <div className="confirm-note">
          ✓ Digitally confirmed by tenant on {new Date(inventory.confirmedAt).toLocaleDateString('en-GB', {day:'numeric',month:'long',year:'numeric'})}
          {inventory.confirmedIp ? ` · IP: ${inventory.confirmedIp}` : ''}
        </div>
      )}
      <div className="footer">
        <span>ID: {inventory.id}</span>
        <span>Generated by Relentify Inventory Manager</span>
      </div>
    </>
  )
}