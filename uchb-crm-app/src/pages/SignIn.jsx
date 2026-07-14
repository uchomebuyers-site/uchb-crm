import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'

export default function SignIn() {
  const { session } = useAuth()
  const [mode, setMode] = useState('link') // 'link' | 'password'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [status, setStatus] = useState('idle') // idle | sending | sent | error
  const [error, setError] = useState('')

  async function handleLinkSubmit(e) {
    e.preventDefault()
    setStatus('sending')
    setError('')

    const { error: signInError } = await supabase.auth.signInWithOtp({
      email: email.trim(),
    })

    if (signInError) {
      setError(signInError.message)
      setStatus('error')
      return
    }

    setStatus('sent')
  }

  async function handlePasswordSubmit(e) {
    e.preventDefault()
    setStatus('sending')
    setError('')

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    })

    if (signInError) {
      setError(signInError.message)
      setStatus('error')
    }
    // On success, useAuth's session updates and the redirect below fires
    // on the next render — no page reload happens for password sign-in
    // like it does for the magic-link email flow, so this component has
    // to navigate itself away rather than relying on Home/ProtectedRoute.
  }

  function switchMode(next) {
    setMode(next)
    setStatus('idle')
    setError('')
  }

  if (session) {
    return <Navigate to="/dashboard" replace />
  }

  return (
    <div className="min-h-screen bg-uchb-cream flex flex-col items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-semibold text-uchb-teal">UCHB CRM</h1>
          <p className="text-uchb-teal/70 mt-1">Upper Cumberland Home Buyers</p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm p-6">
          {status === 'sent' ? (
            <div className="text-center py-4">
              <p className="text-uchb-teal font-medium">Check your email</p>
              <p className="text-uchb-teal/70 text-sm mt-2">
                We sent a sign-in link to {email}. Open it on this device to
                continue.
              </p>
            </div>
          ) : (
            <>
              <div className="flex mb-5 rounded-xl bg-uchb-cream p-1">
                <button
                  type="button"
                  onClick={() => switchMode('link')}
                  className={`flex-1 rounded-lg py-2 text-sm font-medium transition ${
                    mode === 'link' ? 'bg-white text-uchb-teal shadow-sm' : 'text-uchb-teal/60'
                  }`}
                >
                  Email me a link
                </button>
                <button
                  type="button"
                  onClick={() => switchMode('password')}
                  className={`flex-1 rounded-lg py-2 text-sm font-medium transition ${
                    mode === 'password' ? 'bg-white text-uchb-teal shadow-sm' : 'text-uchb-teal/60'
                  }`}
                >
                  Sign in with password
                </button>
              </div>

              <form onSubmit={mode === 'link' ? handleLinkSubmit : handlePasswordSubmit} className="space-y-4">
                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-uchb-teal mb-1">
                    Email
                  </label>
                  <input
                    id="email"
                    type="email"
                    required
                    autoComplete="email"
                    inputMode="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full rounded-xl border border-uchb-teal/20 px-4 py-3 text-base text-uchb-teal focus:outline-none focus:ring-2 focus:ring-uchb-gold"
                    placeholder="you@example.com"
                  />
                </div>

                {mode === 'password' && (
                  <div>
                    <label htmlFor="password" className="block text-sm font-medium text-uchb-teal mb-1">
                      Password
                    </label>
                    <input
                      id="password"
                      type="password"
                      required
                      autoComplete="current-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full rounded-xl border border-uchb-teal/20 px-4 py-3 text-base text-uchb-teal focus:outline-none focus:ring-2 focus:ring-uchb-gold"
                      placeholder="••••••••"
                    />
                  </div>
                )}

                {error && <p className="text-sm text-red-600">{error}</p>}

                <button
                  type="submit"
                  disabled={status === 'sending'}
                  className="w-full rounded-xl bg-uchb-teal text-uchb-cream font-medium py-3 shadow-sm disabled:opacity-60"
                >
                  {status === 'sending'
                    ? mode === 'link'
                      ? 'Sending link…'
                      : 'Signing in…'
                    : mode === 'link'
                      ? 'Send magic link'
                      : 'Sign in'}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
