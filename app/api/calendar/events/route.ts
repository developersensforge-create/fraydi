import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { getTodayEvents } from "@/lib/googleCalendar";
import { NextResponse } from "next/server";

export async function GET() {
  const session = await getServerSession(authOptions) as any;

  if (!session?.accessToken) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const events = await getTodayEvents(session.accessToken);
  return NextResponse.json({ events });
}
