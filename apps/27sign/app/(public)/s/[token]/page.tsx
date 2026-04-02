import SigningClient from './SigningClient'

export default async function SigningPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  return <SigningClient token={token} />
}
