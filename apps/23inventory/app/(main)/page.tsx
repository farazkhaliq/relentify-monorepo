import { query } from '@/lib/db'
import { toInventory, toPhoto, InventoryRow, PhotoRow, InventoryWithPhotos } from '@/lib/types'
import { getAuthUser } from '@/lib/auth'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { CheckCircle2, FileText, ArrowRight } from 'lucide-react'
import DeleteInventoryButton from '@/components/DeleteInventoryButton'
import { 
  Button, 
  Card, 
  CardHeader, 
  CardTitle, 
  CardDescription, 
  Badge,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  PageHeader,
  StatsCard,
  FilterGroup,
  SearchInput,
  TabsNav as Tabs
} from '@relentify/ui'

export const dynamic = 'force-dynamic'

export default async function Dashboard() {
  const user = await getAuthUser()
  if (!user) redirect('https://login.relentify.com/login')

  const { rows: invRows } = await query(
    'SELECT * FROM inv_items WHERE user_id=$1 ORDER BY created_at DESC',
    [user.userId]
  )
  const { rows: photoRows } = await query(
    'SELECT p.* FROM inv_photos p JOIN inv_items i ON p.inventory_id = i.id WHERE i.user_id=$1',
    [user.userId]
  )
  const photosByInv = new Map<string, PhotoRow[]>()
  for (const p of photoRows) {
    const arr = photosByInv.get(p.inventory_id) || []
    arr.push(p)
    photosByInv.set(p.inventory_id, arr)
  }
  const inventories: InventoryWithPhotos[] = invRows.map((row: InventoryRow) => ({
    ...toInventory(row),
    photos: (photosByInv.get(row.id) || []).map(toPhoto),
  }))

  return (
    <>
      <div className="space-y-12">
        <PageHeader 
          supertitle="RELENTIFY PROPERTY INVENTORIES" 
          title="" 
          className="mb-0" 
        />

        <div className="flex flex-col md:flex-row items-center gap-4 md:gap-8 lg:gap-12">
          <SearchInput 
            variant="command" 
            placeholder="Search assets..." 
            className="w-full md:w-80" 
          />
          
          <div className="flex items-center gap-12 ml-auto">
            <FilterGroup 
              options={[
                { label: 'All', value: 'all' },
                { label: 'In', value: 'check-in' },
                { label: 'Out', value: 'check-out' }
              ]}
              selectedValue="all"
            />
            
            <Tabs 
              options={[
                { label: 'List', value: 'list' },
                { label: 'Grid', value: 'grid' }
              ]}
              selectedValue="list"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
          <StatsCard 
            label="PORTFOLIO VOLUME" 
            value={inventories.length} 
            icon={FileText} 
          />
          <StatsCard 
            label="Check-In" 
            value={inventories.filter(i => i.type === 'check-in').length} 
            icon={ArrowRight} 
          />
          <StatsCard 
            label="Check-Out" 
            value={inventories.filter(i => i.type === 'check-out').length} 
            icon={ArrowRight} 
          />
          <StatsCard 
            label="Confirmed" 
            value={inventories.filter(i => i.tenantConfirmed).length} 
            icon={CheckCircle2} 
          />
        </div>

        <Card className="overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between border-b border-[var(--theme-border)] px-12">
            <div>
              <CardTitle className="text-xl tracking-tight">Active Records</CardTitle>
              <CardDescription>Managed Property Assets</CardDescription>
            </div>
            <Badge variant="outline">{inventories.length} TOTAL</Badge>
          </CardHeader>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Property Address</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Agent</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {inventories.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="py-32 text-center">
                    <div className="flex flex-col items-center gap-4 opacity-20">
                      <FileText size={48} />
                      <span className="font-mono text-[var(--theme-text-75)] uppercase tracking-widest">System storage empty</span>
                    </div>
                    <Link href="/inventory/new">
                      <Button variant="outline" size="sm" className="mt-8">Initialise Asset</Button>
                    </Link>
                  </TableCell>
                </TableRow>
              ) : inventories.map(inv => (
                <TableRow key={inv.id} className="group relative">
                  <TableCell className="relative">
                    <Link href={`/inventory/${inv.id}`} className="absolute inset-0 z-10" />
                    <div className="font-bold text-[var(--theme-text)] group-hover:text-[var(--theme-accent)] transition-colors">{inv.propertyAddress}</div>
                    <div className="text-[var(--theme-text-10)] text-[var(--theme-text-dim)] mt-1 font-mono tracking-wider">
                      {new Date(inv.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </div>
                  </TableCell>
                  <TableCell className="relative">
                    <Link href={`/inventory/${inv.id}`} className="absolute inset-0 z-10" />
                    <Badge variant={inv.type === 'check-in' ? 'accent' : 'warning'}>
                      {inv.type}
                    </Badge>
                  </TableCell>
                  <TableCell className="relative text-[var(--theme-text-85)] text-[var(--theme-text-muted)] font-medium">
                    <Link href={`/inventory/${inv.id}`} className="absolute inset-0 z-10" />
                    {inv.createdBy}
                  </TableCell>
                  <TableCell className="relative">
                    <Link href={`/inventory/${inv.id}`} className="absolute inset-0 z-10" />
                    {inv.tenantConfirmed
                      ? <Badge variant="success" className="gap-1.5"><CheckCircle2 size={10} /> Confirmed</Badge>
                      : <span className="text-[var(--theme-text-10)] font-mono font-bold uppercase tracking-wider text-[var(--theme-text-dim)] italic">Awaiting Signature</span>}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-6 relative z-20">
                      <Link href={`/inventory/${inv.id}`} className="text-[var(--theme-text)] hover:text-[var(--theme-accent)] font-bold text-[var(--theme-text-10)] uppercase tracking-widest transition-all flex items-center gap-1 group/btn">
                        Audit <ArrowRight size={14} className="group-hover/btn:translate-x-1 transition-transform" />
                      </Link>
                      <Link href={`/inventory/${inv.id}/edit`} className="text-[var(--theme-text-dim)] hover:text-[var(--theme-text)] font-mono text-[var(--theme-text-10)] uppercase tracking-widest transition-colors">
                        Edit
                      </Link>
                      <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                        <DeleteInventoryButton id={inv.id} />
                      </div>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      </div>
    </>
  )
}
