import { redirect } from 'next/navigation'
export default function ForgotPasswordPage() {
  redirect('https://auth.relentify.com/forgot-password')
}
