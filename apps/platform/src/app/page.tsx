import { redirect } from 'next/navigation'
import { getProduct } from '@/lib/product-context'

export default async function Home() {
  const product = await getProduct()
  if (product === 'crm') redirect('/dashboard')
  redirect('/inbox')
}
