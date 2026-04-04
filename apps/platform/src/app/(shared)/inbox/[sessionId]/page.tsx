import { redirect } from 'next/navigation'

// Session detail route — redirect to inbox with the session selected
// The inbox page handles session display via client-side state
export default async function SessionDetailPage({ params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await params
  // For now, redirect to inbox. The inbox client component will handle selection.
  redirect('/inbox')
}
