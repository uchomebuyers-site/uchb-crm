// Supabase's client strips #error=... params from the URL as soon as it
// initializes (detectSessionInUrl), before React's first render. This module
// must be imported before ../lib/supabase.js (see main.jsx import order) so
// it captures the raw hash first.
const params = new URLSearchParams(window.location.hash.replace(/^#\/?/, ''))
const error = params.get('error')

export const authHashError = error
  ? { error, code: params.get('error_code'), description: params.get('error_description') }
  : null
