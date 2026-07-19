import { useState } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from './hooks/useAuth'
import { authHashError } from './lib/authHashError.js'
import ProtectedRoute from './components/ProtectedRoute'
import AdminRoute from './components/AdminRoute'
import SignIn from './pages/SignIn'
import Dashboard from './pages/Dashboard'
import LeadsList from './pages/LeadsList'
import NewLead from './pages/NewLead'
import LeadDetail from './pages/LeadDetail'
import Pipeline from './pages/Pipeline'
import FollowUps from './pages/FollowUps'
import AdminUsers from './pages/AdminUsers'
import AdminActivity from './pages/AdminActivity'
import Help from './pages/Help'

function AuthLinkExpired({ onDismiss }) {
  return (
    <div className="min-h-screen bg-uchb-cream flex flex-col items-center justify-center gap-4 px-6 text-center">
      <p className="text-lg font-semibold text-uchb-teal">This sign-in link has expired</p>
      <p className="text-sm text-uchb-teal/70">
        Request a new one or sign in with your password below.
      </p>
      <button
        type="button"
        onClick={onDismiss}
        className="rounded-xl bg-uchb-teal px-6 py-3 font-medium text-uchb-cream"
      >
        Back to sign in
      </button>
    </div>
  )
}

function Home() {
  const { session, loading } = useAuth()

  if (loading) return null

  return <Navigate to={session ? '/dashboard' : '/sign-in'} replace />
}

export default function App() {
  const [authErrorDismissed, setAuthErrorDismissed] = useState(false)

  if (authHashError && !authErrorDismissed) {
    return <AuthLinkExpired onDismiss={() => setAuthErrorDismissed(true)} />
  }

  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/sign-in" element={<SignIn />} />
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <Dashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/leads"
        element={
          <ProtectedRoute>
            <LeadsList />
          </ProtectedRoute>
        }
      />
      <Route
        path="/leads/new"
        element={
          <ProtectedRoute>
            <NewLead />
          </ProtectedRoute>
        }
      />
      <Route
        path="/leads/:id"
        element={
          <ProtectedRoute>
            <LeadDetail />
          </ProtectedRoute>
        }
      />
      <Route
        path="/pipeline"
        element={
          <ProtectedRoute>
            <Pipeline />
          </ProtectedRoute>
        }
      />
      <Route
        path="/follow-ups"
        element={
          <ProtectedRoute>
            <FollowUps />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/users"
        element={
          <ProtectedRoute>
            <AdminRoute>
              <AdminUsers />
            </AdminRoute>
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/activity"
        element={
          <ProtectedRoute>
            <AdminRoute>
              <AdminActivity />
            </AdminRoute>
          </ProtectedRoute>
        }
      />
      <Route
        path="/help"
        element={
          <ProtectedRoute>
            <Help />
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
