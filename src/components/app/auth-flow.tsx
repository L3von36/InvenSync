'use client'

import { useState, Suspense, lazy } from 'react'
import { TwoFactorRequiredError } from '@/lib/stores/auth-store'

const LandingPage = lazy(() => import('@/components/app/landing/landing-page').then(m => ({ default: m.LandingPage })))
const LoginPage = lazy(() => import('@/components/app/auth/login-page').then(m => ({ default: m.LoginPage })))
const RegisterPage = lazy(() => import('@/components/app/auth/register-page').then(m => ({ default: m.RegisterPage })))
const ResetPasswordPage = lazy(() => import('@/components/app/auth/reset-password-page').then(m => ({ default: m.ResetPasswordPage })))
const TwoFactorPageLazy = lazy(() => import('@/components/app/auth/two-factor-page').then(m => ({ default: m.TwoFactorPage })))

function LoadingFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="animate-spin size-8 border-2 border-primary border-t-transparent rounded-full" />
    </div>
  )
}

type AuthView = 'landing' | 'login' | 'register' | 'reset-password' | 'two-factor'

interface TwoFactorState {
  tempToken: string
  userEmail: string
  userName: string
}

export default function AuthFlow() {
  const [authView, setAuthView] = useState<AuthView>('landing')
  const [twoFactorState, setTwoFactorState] = useState<TwoFactorState | null>(null)

  const handleLogin = async () => {
    // This is called by the LoginPage. The LoginPage calls authStore.login()
    // which may throw TwoFactorRequiredError. The LoginPage catches it and
    // we handle the transition here via a callback.
  }

  const handleTwoFactorRequired = (err: TwoFactorRequiredError) => {
    setTwoFactorState({
      tempToken: err.tempToken,
      userEmail: err.userEmail,
      userName: err.userName,
    })
    setAuthView('two-factor')
  }

  const handleTwoFactorBack = () => {
    setTwoFactorState(null)
    setAuthView('login')
  }

  if (authView === 'two-factor' && twoFactorState) {
    return (
      <Suspense fallback={<LoadingFallback />}>
        <TwoFactorPageLazy
          tempToken={twoFactorState.tempToken}
          userEmail={twoFactorState.userEmail}
          userName={twoFactorState.userName}
          onBack={handleTwoFactorBack}
        />
      </Suspense>
    )
  }

  if (authView === 'login') {
    return (
      <Suspense fallback={<LoadingFallback />}>
        <LoginPage
          onSwitchToRegister={() => setAuthView('register')}
          onSwitchToResetPassword={() => setAuthView('reset-password')}
          onBack={() => setAuthView('landing')}
          onTwoFactorRequired={handleTwoFactorRequired}
        />
      </Suspense>
    )
  }
  if (authView === 'register') {
    return (
      <Suspense fallback={<LoadingFallback />}>
        <RegisterPage onSwitchToLogin={() => setAuthView('login')} onBack={() => setAuthView('landing')} />
      </Suspense>
    )
  }
  if (authView === 'reset-password') {
    return (
      <Suspense fallback={<LoadingFallback />}>
        <ResetPasswordPage
          onSwitchToLogin={() => setAuthView('login')}
          onBack={() => setAuthView('login')}
        />
      </Suspense>
    )
  }
  return (
    <Suspense fallback={<LoadingFallback />}>
      <LandingPage onLogin={() => setAuthView('login')} onRegister={() => setAuthView('register')} />
    </Suspense>
  )
}
