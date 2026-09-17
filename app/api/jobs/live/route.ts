import { NextRequest, NextResponse } from "next/server";
import { findLiveJobs } from "@/lib/find-jobs";
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

    const jobs = await findLiveJobs();
    const persisted = await persistJobs(jobs);

    return NextResponse.json({
      jobs,
      persisted: persisted.count,
      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Search failed" },
      { status: 500 },
    );
  }
}
