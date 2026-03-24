import { redirect } from 'next/navigation'
export default function LoginPage() {
  redirect('https://auth.relentify.com/login?redirect=https://crm.relentify.com/dashboard')
}
