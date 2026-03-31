import Link from 'next/link'
import { Card } from '@relentify/ui'
import { getAllCategories, getArticlesByCategory } from '@/lib/content'
import { HelpSearch } from '@/components/HelpSearch'

const CATEGORY_META: Record<string, { label: string; description: string; icon: string }> = {
  accounting: {
    label: 'Accounting',
    description: 'Invoices, bills, expenses, bank reconciliation, and reports.',
    icon: '📊',
  },
  crm: {
    label: 'CRM',
    description: 'Customers, suppliers, contacts, and relationships.',
    icon: '👥',
  },
  reminders: {
    label: 'Reminders',
    description: 'Tasks, deadlines, and notifications.',
    icon: '🔔',
  },
  api: {
    label: 'Developer API',
    description: 'API reference, authentication, and webhooks.',
    icon: '⚙️',
  },
  migration: {
    label: 'Migration',
    description: 'Import data from spreadsheets and other accounting systems.',
    icon: '📥',
  },
}

export default function HomePage() {
  const categories = getAllCategories()

  return (
    <div>
      <h1 className="text-3xl font-bold mb-2">How can we help?</h1>
      <p className="text-[var(--theme-text-muted)] mb-8">
        Browse guides or search for what you need.
      </p>

      <div className="mb-12">
        <HelpSearch />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {categories.map(category => {
          const meta = CATEGORY_META[category]
          const articles = getArticlesByCategory(category)
          if (!meta) return null
          return (
            <Card key={category} className="p-6 hover:border-[var(--theme-accent)] transition-colors cursor-pointer">
              <Link href={`/${category}`} className="block no-underline">
                <div className="text-3xl mb-3">{meta.icon}</div>
                <h2 className="font-semibold text-lg mb-1">{meta.label}</h2>
                <p className="text-sm text-[var(--theme-text-muted)] mb-2">{meta.description}</p>
                <p className="text-xs text-[var(--theme-accent)]">{articles.length} articles</p>
              </Link>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
