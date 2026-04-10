import type { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import { createClient } from '@supabase/supabase-js'

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''
  )
}

async function refreshAccessToken(token: Record<string, unknown>) {
  try {
    const url = "https://oauth2.googleapis.com/token";
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID ?? "",
        client_secret: process.env.GOOGLE_CLIENT_SECRET ?? "",
        grant_type: "refresh_token",
        refresh_token: token.refreshToken as string,
      }),
    });
    const refreshed = await res.json();
    if (!res.ok) throw refreshed;
    return {
      ...token,
      accessToken: refreshed.access_token,
      accessTokenExpires: Date.now() + refreshed.expires_in * 1000,
      refreshToken: refreshed.refresh_token ?? token.refreshToken,
      error: undefined,
    };
  } catch {
    return { ...token, error: "RefreshAccessTokenError" };
  }
}

export const authOptions: NextAuthOptions = {
  secret: process.env.NEXTAUTH_SECRET,
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID ?? "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
      authorization: {
        params: {
          scope: "openid email profile https://www.googleapis.com/auth/calendar.readonly",
          access_type: "offline",
          prompt: "consent",
        },
      },
    }),
  ],
  pages: {
    signIn: "/login",
  },
  callbacks: {
    async jwt({ token, account, user }) {
      // First sign-in: save tokens + store in DB
      if (account?.access_token) {
        // Store token in google_calendar_tokens table for family sharing
        try {
          const db = getSupabaseAdmin()
          const email = user?.email ?? (token.email as string)
          if (email) {
            const { data: profile } = await db.from('profiles').select('id').eq('email', email).single()
            if (profile?.id) {
              await db.from('google_calendar_tokens').upsert({
                profile_id: profile.id,
                access_token: account.access_token,
                refresh_token: account.refresh_token ?? null,
                expires_at: account.expires_at ? new Date(account.expires_at * 1000).toISOString() : null,
                updated_at: new Date().toISOString(),
              }, { onConflict: 'profile_id' })
            }
          }
        } catch { /* non-fatal */ }
        return {
          ...token,
          accessToken: account.access_token,
          accessTokenExpires: account.expires_at ? account.expires_at * 1000 : Date.now() + 3600 * 1000,
          refreshToken: account.refresh_token,
        };
      }
      // Token still valid
      if (Date.now() < ((token.accessTokenExpires as number) ?? 0)) {
        return token;
      }
      // Token expired — refresh if we have a refresh token, otherwise keep existing
      if (!(token as Record<string, unknown>).refreshToken) return token;
      return refreshAccessToken(token as Record<string, unknown>);
    },
    async session({ session, token }) {
      const s = session as unknown as Record<string, unknown>;
      s.accessToken = token.accessToken;
      s.error = token.error;
      return session;
    },
  },
};
