import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  // In development, surface a clear error instead of a cryptic crash
  console.warn(
    '[Fraydi] Supabase environment variables are not set.\n' +
      'Copy .env.example → .env.local and fill in your Supabase project URL and anon key.'
  )
}

/**
 * Supabase browser/server client
 *
 * Usage (client component):
 *   import { supabase } from '@/lib/supabase'
 *   const { data, error } = await supabase.from('tasks').select('*')
 *
 * For server-side operations with elevated privileges, use the service role key
 * in a separate server-only client (never expose to the browser).
 */
export const supabase = createClient(
  supabaseUrl ?? 'https://placeholder.supabase.co',
  supabaseAnonKey ?? 'placeholder-anon-key'
)

// ---------------------------------------------------------------------------
// Typed helpers — expand as DB schema is defined
// ---------------------------------------------------------------------------

/** Family member profile from `profiles` table */
export type Profile = {
  id: string
  full_name: string
  avatar_url?: string
  family_id: string
  created_at: string
}

/** Coordination task from `tasks` table */
export type Task = {
  id: string
  family_id: string
  question: string
  assigned_to?: string | null
  urgency: 'low' | 'medium' | 'high'
  resolved: boolean
  created_at: string
}

/** Shopping list item from `shopping_items` table */
export type ShoppingItem = {
  id: string
  family_id: string
  name: string
  checked: boolean
  added_by: string
  created_at: string
}
