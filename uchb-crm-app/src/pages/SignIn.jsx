import { useState } from 'react'
import { supabase } from '../lib/supabase'

export default function SignIn() {
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState('idle') // idle | sending | sent | error
  const [error, setError] = useState('')

  async function handleSubmit(e) {
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
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label
                  htmlFor="email"
                  className="block text-sm font-medium text-uchb-teal mb-1"
                >
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

              {error && <p className="text-sm text-red-600">{error}</p>}

              <button
                type="submit"
                disabled={status === 'sending'}
                className="w-full rounded-xl bg-uchb-teal text-uchb-cream font-medium py-3 shadow-sm disabled:opacity-60"
              >
                {status === 'sending' ? 'Sending link…' : 'Send magic link'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
