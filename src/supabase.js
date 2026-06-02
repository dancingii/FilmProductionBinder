import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://bjxgrfmrjkkxzkhciitp.supabase.co";
const supabaseAnonKey =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJqeGdyZm1yamtreHpraGNpaXRwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg2NjExNDcsImV4cCI6MjA3NDIzNzE0N30.gAbIx06_oDCM0aw8YmTQGyzX4jJKzLfQJfPg4aulrFU";

// Quota-safe localStorage adapter.
//
// @supabase/auth-js v2.57.x calls setItemAsync (which calls storage.setItem)
// during _recoverAndRefresh on every page load — writing both the session token
// and a separate `storageKey + "-user"` entry. If localStorage is at quota, that
// setItem throws a QuotaExceededError. The auth client does NOT catch storage
// errors inside setItemAsync, so the exception propagates into _recoverAndRefresh,
// is caught at the top level, and the entire session recovery is silently aborted.
// getSession() then returns null → the user appears logged out on every refresh.
//
// This adapter wraps setItem with a try/catch. If the write fails due to quota:
//   1. The existing session token (already in localStorage from login) is preserved.
//   2. Recovery continues — the session remains valid for this page load.
//   3. A dev-mode warning identifies which key could not be written.
//
// getItem and removeItem are passed through unchanged — they do not throw on quota.
const quotaSafeLocalStorage = {
  getItem: (key) => {
    try { return localStorage.getItem(key); } catch { return null; }
  },
  setItem: (key, value) => {
    try {
      localStorage.setItem(key, value);
    } catch (err) {
      if (process.env.NODE_ENV === "development") {
        console.warn(`[supabase] localStorage.setItem("${key}") failed (quota or security):`, err?.name);
      }
      // Do not rethrow — auth recovery must not abort due to a cache write failure.
    }
  },
  removeItem: (key) => {
    try { localStorage.removeItem(key); } catch {}
  },
};

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storage: quotaSafeLocalStorage,
  },
});
