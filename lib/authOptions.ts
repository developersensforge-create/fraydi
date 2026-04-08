import { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

async function upsertProfile(email: string, name: string, avatar: string) {
  // Check if profile exists by email; create if not
  try {
    const checkRes = await fetch(
      `${SUPABASE_URL}/rest/v1/profiles?email=eq.${encodeURIComponent(email)}&select=id`,
      { headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` } }
    );
    const existing = checkRes.ok ? await checkRes.json() : [];
    if (existing.length === 0) {
      // Create new profile
      await fetch(`${SUPABASE_URL}/rest/v1/profiles`, {
        method: "POST",
        headers: {
          apikey: SERVICE_KEY,
          Authorization: `Bearer ${SERVICE_KEY}`,
          "Content-Type": "application/json",
          Prefer: "return=minimal",
        },
        body: JSON.stringify({ email, full_name: name, avatar_url: avatar, role: "member" }),
      });
    } else {
      // Update name/avatar
      await fetch(
        `${SUPABASE_URL}/rest/v1/profiles?email=eq.${encodeURIComponent(email)}`,
        {
          method: "PATCH",
          headers: {
            apikey: SERVICE_KEY,
            Authorization: `Bearer ${SERVICE_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ full_name: name, avatar_url: avatar }),
        }
      );
    }
  } catch (e) {
    console.error("[authOptions] upsertProfile failed:", e);
  }
}

async function refreshAccessToken(token: any) {
  try {
    const url = "https://oauth2.googleapis.com/token";
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID ?? "",
        client_secret: process.env.GOOGLE_CLIENT_SECRET ?? "",
        grant_type: "refresh_token",
        refresh_token: token.refreshToken,
      }),
    });
    const refreshed = await response.json();
    if (!response.ok) throw refreshed;
    return {
      ...token,
      accessToken: refreshed.access_token,
      // New expiry: now + expires_in seconds (usually 3600)
      expiresAt: Math.floor(Date.now() / 1000) + (refreshed.expires_in ?? 3600),
      // Google only returns a new refresh token sometimes — keep old one if not provided
      refreshToken: refreshed.refresh_token ?? token.refreshToken,
      error: undefined,
    };
  } catch (error) {
    console.error("[authOptions] Token refresh failed:", error);
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
          scope: [
            "openid",
            "email",
            "profile",
            "https://www.googleapis.com/auth/calendar.readonly",
            "https://www.googleapis.com/auth/calendar.events.readonly",
            "https://www.googleapis.com/auth/calendar.events",
            "https://www.googleapis.com/auth/calendar.events.owned",
          ].join(" "),
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
    async jwt({ token, account, profile }) {
      // Initial sign-in — save all tokens + upsert profile in Supabase
      if (account) {
        // Create/update profile row so family API can look up by email
        if (token.email) {
          await upsertProfile(
            token.email as string,
            (token.name as string) ?? "",
            (token.picture as string) ?? ""
          );
        }
        return {
          ...token,
          accessToken: account.access_token,
          refreshToken: account.refresh_token,
          expiresAt: account.expires_at, // seconds since epoch
        };
      }

      // Token still valid — return as-is
      const nowSec = Math.floor(Date.now() / 1000);
      if (token.expiresAt && nowSec < (token.expiresAt as number) - 60) {
        return token;
      }

      // Token expired or expiring soon — refresh it
      return refreshAccessToken(token);
    },
    async session({ session, token }) {
      session.accessToken = token.accessToken as string;
      // Bubble up refresh errors so the UI can prompt re-auth
      if ((token as any).error) {
        (session as any).error = (token as any).error;
      }
      return session;
    },
  },
};
