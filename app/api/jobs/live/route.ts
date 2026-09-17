import { NextRequest, NextResponse } from "next/server";
import { findLiveJobs } from "@/lib/find-jobs-7d";
import { persistJobs } from "@/lib/persist-jobs";
import { createAdminSupabase } from "@/lib/supabase-admin";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("authorization") || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";

  if (!token) {
    return NextResponse.json({ error: "Sign in to run a job scan." }, { status: 401 });
  }

  try {
    const supabase = createAdminSupabase();
    const { data, error: authError } = await supabase.auth.getUser(token);

    if (authError || !data.user) {
      return NextResponse.json({ error: "Your session is invalid or expired. Sign in again." }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from("user_profiles")
      .select("id")
      .eq("auth_user_id", data.user.id)
      .maybeSingle();

    const discoveredJobs = await findLiveJobs();
    const persisted = await persistJobs(discoveredJobs, profile?.id);

    return NextResponse.json({
      jobs: persisted.jobs,
      persisted: persisted.count,
      windowDays: 7,
      scope: "Tamil Nadu statewide · Kerala statewide · Bengaluru",
      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Search failed" },
      { status: 500 },
    );
  }
}
