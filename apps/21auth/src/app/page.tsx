import { redirect } from 'next/navigation'
import { getAuthUser } from '@/src/lib/auth'

export default async function Home() {
  const user = await getAuthUser()
  if (user) redirect('/portal')
  redirect('/login')
}
