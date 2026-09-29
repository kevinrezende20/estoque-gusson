import { createFileRoute, redirect } from '@tanstack/react-router'
import { LoginForm } from '@/components/auth/LoginForm'
import { supabase } from '@/lib/supabase'

export const Route = createFileRoute('/login')({
  beforeLoad: async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (session) {
      throw redirect({ to: '/' })
    }
  },
  component: LoginPage,
})

function LoginPage() {
  return (
    <div className="min-h-screen bg-background flex flex-col justify-center items-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-primary">Controle Gusson</h1>
          <p className="text-muted-foreground mt-2">Sistema Interno de Gestão</p>
        </div>
        <LoginForm />
      </div>
    </div>
  )
}
