import { prisma } from '@/lib/prisma'
import { getAuthUser } from '@/lib/auth'
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import PhotoManager from '@/components/PhotoManager'
import CopyConfirmLink from '@/components/CopyConfirmLink'
import { ArrowLeft, FileText, Pencil, Sparkles, MapPin, Calendar, Camera, User } from 'lucide-react'
import { 
  Button, 
  Card, 
  CardHeader, 
  CardDescription, 
  CardContent,
  Badge,
  StatsCard,
  PageHeader
} from '@relentify/ui'

export const dynamic = 'force-dynamic'

export default async function InventoryDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await getAuthUser()
  if (!user) redirect('https://login.relentify.com/login')

  const inventory = await prisma.inventory.findUnique({
    where: { id: id, userId: user.userId },
    include: { photos: { orderBy: { uploadedAt: 'asc' } } },
  })
  if (!inventory) notFound()

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3003'
  const confirmUrl = `${baseUrl}/confirm/${inventory.confirmToken}`

  return (
    <div className="space-y-12">
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-8">
        <div className="space-y-6">
          <Link href="/" className="group inline-flex items-center gap-2 text-[var(--theme-text-dim)] hover:text-[var(--theme-text)] transition-colors font-mono text-[var(--theme-text-10)] uppercase tracking-widest">
            <ArrowLeft size={14} className="group-hover:-translate-x-1 transition-transform" /> 
            Hub
          </Link>
          <div className="space-y-4">
            <PageHeader 
              supertitle="RELENTIFY PROPERTY INVENTORIES" 
              title={inventory.propertyAddress} 
              className="mb-0" 
            />
            <h1 className="text-2xl font-bold tracking-tight text-[var(--theme-text)]">
              {inventory.propertyAddress}
            </h1>
            <div className="flex items-center gap-6 text-[var(--theme-text-dim)] font-mono text-[var(--theme-text-10)] uppercase tracking-[0.2em]">
              <div className="flex items-center gap-2">
                <Badge variant={inventory.type === 'check-in' ? 'accent' : 'warning'}>
                  {inventory.type}
                </Badge>
              </div>
              <div className="flex items-center gap-2"><Calendar size={14} className="text-[var(--theme-accent)]" /> {new Date(inventory.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</div>
              <div className="flex items-center gap-2"><Camera size={14} className="text-[var(--theme-accent)]" /> {inventory.photos.length} Captures</div>
              {inventory.tenantConfirmed && (
                <Badge variant="success">Verified</Badge>
              )}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-3 no-print pt-14">
          <Link href={`/inventory/${inventory.id}/edit`}>
            <Button variant="ghost" size="sm" className="h-11 rounded-xl border border-[var(--theme-border)] bg-[var(--theme-card)] font-mono text-[var(--theme-text-10)] uppercase tracking-widest px-6">
              <Pencil size={14} className="mr-2" /> Edit
            </Button>
          </Link>
          <a href={`/report/${inventory.id}`} target="_blank">
            <Button variant="ghost" size="sm" className="h-11 rounded-xl border border-[var(--theme-border)] bg-[var(--theme-card)] font-mono text-[var(--theme-text-10)] uppercase tracking-widest px-6">
              <FileText size={14} className="mr-2" /> Report
            </Button>
          </a>
          <CopyConfirmLink
            url={confirmUrl}
            inventoryId={inventory.id}
            tenantEmail={inventory.tenantEmail}
            emailSentAt={inventory.emailSentAt?.toISOString() ?? null}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatsCard label="Reporting Agent" value={inventory.createdBy} icon={User} />
        <StatsCard label="Status" value={inventory.tenantConfirmed ? 'System Verified' : 'Awaiting Stakeholder'} icon={Sparkles} />
        <StatsCard label="Data Persistence" value="Cloud Synchronised" icon={MapPin} />
      </div>

      {inventory.notes && (
        <Card className="bg-[var(--theme-accent)]/5">
          <CardHeader className="pb-4">
            <CardDescription className="text-[var(--theme-accent)]">Intelligence Briefing</CardDescription>
          </CardHeader>
          <CardContent className="text-[var(--theme-text-muted)] text-[var(--theme-text-85)] leading-relaxed whitespace-pre-wrap">
            {inventory.notes}
          </CardContent>
        </Card>
      )}

      <PhotoManager
        inventoryId={inventory.id}
        initialPhotos={inventory.photos.map(p => ({
          id: p.id,
          room: p.room,
          condition: p.condition,
          description: p.description,
          imageData: p.imageData || null,
          uploadedAt: p.uploadedAt.toISOString(),
        }))}
      />
    </div>
  )
}
