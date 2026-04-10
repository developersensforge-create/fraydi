import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    '[Fraydi] Supabase environment variables are not set.\n' +
      'Copy .env.example → .env.local and fill in your Supabase project URL and anon key.'
  )
}

// ---------------------------------------------------------------------------
// Database Types — generated from schema
// ---------------------------------------------------------------------------

export type Family = {
  id: string
  name: string
  created_at: string
  invite_code: string
}

export type Profile = {
  id: string
  family_id: string | null
  full_name: string | null
  avatar_url: string | null
  role: 'admin' | 'member'
  color: string
  created_at: string
}

export type CalendarEvent = {
  id: string
  family_id: string
  profile_id: string
  google_event_id: string | null
  title: string
  description: string | null
  start_time: string
  end_time: string
  location: string | null
  is_child_event: boolean
  requires_coverage: boolean
  assigned_to: string | null
  assignment_confirmed: boolean
  created_at: string
}

export type ShoppingItem = {
  id: string
  family_id: string
  added_by: string | null
  name: string
  category: string | null
  quantity: string | null
  is_checked: boolean
  created_at: string
}

export type Todo = {
  id: string
  family_id: string
  created_by: string | null
  assigned_to: string | null
  title: string
  description: string | null
  due_date: string | null
  is_done: boolean
  created_at: string
}

export type CoordinationAssignment = {
  id: string
  event_id: string
  family_id: string
  assigned_to: string | null
  assigned_by: string | null
  status: 'pending' | 'confirmed' | 'declined'
  notified_at: string | null
  confirmed_at: string | null
  created_at: string
}

export type GoogleCalendarToken = {
  id: string
  profile_id: string
  access_token: string | null
  refresh_token: string | null
  expires_at: string | null
  created_at: string
  updated_at: string
}

export type WatchSource = {
  id: string
  family_id: string
  profile_id: string | null
  name: string
  type: 'ical_url' | 'manual'
  url: string | null
  color: string
  active: boolean
  last_synced_at: string | null
  created_at: string
}

export type WatchEvent = {
  id: string
  family_id: string
  source_id: string | null
  title: string
  description: string | null
  start_time: string | null
  end_time: string | null
  location: string | null
  url: string | null
  interest_level: 'watch' | 'interested' | 'hot'
  dismissed: boolean
  created_at: string
}

export type Routine = {
  id: string
  family_id: string
  assigned_to: string | null
  title: string
  description: string | null
  recurrence: 'daily' | 'weekly' | 'monthly'
  days_of_week: number[]
  time_of_day: string | null
  reminder_minutes_before: number
  active: boolean
  created_at: string
}

// ---------------------------------------------------------------------------
// Database schema map (for typed Supabase client)
// ---------------------------------------------------------------------------

export type Database = {
  public: {
    Tables: {
      families: {
        Row: Family
        Insert: Omit<Family, 'id' | 'created_at' | 'invite_code'> & {
          id?: string
          created_at?: string
          invite_code?: string
        }
        Update: Partial<Omit<Family, 'id'>>
      }
      profiles: {
        Row: Profile
        Insert: Omit<Profile, 'created_at'> & { created_at?: string }
        Update: Partial<Omit<Profile, 'id'>>
      }
      calendar_events: {
        Row: CalendarEvent
        Insert: Omit<CalendarEvent, 'id' | 'created_at'> & {
          id?: string
          created_at?: string
        }
        Update: Partial<Omit<CalendarEvent, 'id'>>
      }
      shopping_items: {
        Row: ShoppingItem
        Insert: Omit<ShoppingItem, 'id' | 'created_at'> & {
          id?: string
          created_at?: string
        }
        Update: Partial<Omit<ShoppingItem, 'id'>>
      }
      todos: {
        Row: Todo
        Insert: Omit<Todo, 'id' | 'created_at'> & {
          id?: string
          created_at?: string
        }
        Update: Partial<Omit<Todo, 'id'>>
      }
      coordination_assignments: {
        Row: CoordinationAssignment
        Insert: Omit<CoordinationAssignment, 'id' | 'created_at'> & {
          id?: string
          created_at?: string
        }
        Update: Partial<Omit<CoordinationAssignment, 'id'>>
      }
      google_calendar_tokens: {
        Row: GoogleCalendarToken
        Insert: Omit<GoogleCalendarToken, 'id' | 'created_at' | 'updated_at'> & {
          id?: string
          created_at?: string
          updated_at?: string
        }
        Update: Partial<Omit<GoogleCalendarToken, 'id'>>
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Supabase client
// ---------------------------------------------------------------------------

/**
 * Supabase browser/server client with full type safety.
 *
 * Usage (client component):
 *   import { supabase } from '@/lib/supabase'
 *   const { data, error } = await supabase.from('families').select('*')
 *
 * For server-side operations with elevated privileges, create a separate
 * server-only client using the service role key (never expose to the browser).
 */
export const supabase = createClient<Database>(
  supabaseUrl ?? 'https://placeholder.supabase.co',
  supabaseAnonKey ?? 'placeholder-anon-key'
)

// ---------------------------------------------------------------------------
// Convenience helpers
// ---------------------------------------------------------------------------

/** Get the current user's profile */
export async function getProfile(userId: string) {
  return supabase.from('profiles').select('*').eq('id', userId).single()
}

/** Get all profiles for a given family */
export async function getFamilyProfiles(familyId: string) {
  return supabase.from('profiles').select('*').eq('family_id', familyId)
}

/** Get upcoming events for a family */
export async function getUpcomingEvents(familyId: string, limit = 20) {
  return supabase
    .from('calendar_events')
    .select('*')
    .eq('family_id', familyId)
    .gte('start_time', new Date().toISOString())
    .order('start_time', { ascending: true })
    .limit(limit)
}

/** Get unchecked shopping items for a family */
export async function getShoppingList(familyId: string) {
  return supabase
    .from('shopping_items')
    .select('*')
    .eq('family_id', familyId)
    .eq('is_checked', false)
    .order('created_at', { ascending: true })
}

/** Get open todos for a family */
export async function getOpenTodos(familyId: string) {
  return supabase
    .from('todos')
    .select('*')
    .eq('family_id', familyId)
    .eq('is_done', false)
    .order('due_date', { ascending: true })
}

/** Get pending coordination assignments for a user */
export async function getPendingAssignments(userId: string) {
  return supabase
    .from('coordination_assignments')
    .select('*, calendar_events(*)')
    .eq('assigned_to', userId)
    .eq('status', 'pending')
    .order('created_at', { ascending: false })
}
