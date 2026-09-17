import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabase } from "@/lib/supabase-admin";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const email = String(body?.email || "").trim().toLowerCase();
    const password = String(body?.password || "");

    if (!email || !email.includes("@")) {
      return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
    }

    if (password.length < 8) {
      return NextResponse.json(
        { error: "Password must be at least 8 characters." },
        { status: 400 },
      );
    }

    const allowedEmail = process.env.ALLOWED_USER_EMAIL?.trim().toLowerCase();
    if (allowedEmail && email !== allowedEmail) {
      return NextResponse.json(
        { error: "This email is not allowed to use VIP-Hunter." },
        { status: 403 },
      );
    }

    const supabase = createAdminSupabase();
    const { data: usersData, error: usersError } = await supabase.auth.admin.listUsers({
      page: 1,
      perPage: 1000,
    });

    if (usersError) throw usersError;

    const existingUser = usersData.users.find(
      (user) => user.email?.toLowerCase() === email,
    );

    if (!existingUser) {
      return NextResponse.json(
        { error: "No existing VIP-Hunter account was found for this email." },
        { status: 404 },
      );
    }

    if (existingUser.app_metadata?.password_setup_complete === true) {
      return NextResponse.json(
        { error: "Password has already been created for this account. Sign in instead." },
        { status: 409 },
      );
    }

    const { error } = await supabase.auth.admin.updateUserById(existingUser.id, {
      password,
      email_confirm: true,
      app_metadata: {
        ...existingUser.app_metadata,
        password_setup_complete: true,
      },
    });

    if (error) throw error;

    return NextResponse.json({
      ok: true,
      message: "Password created. You can sign in now.",
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Password setup failed." },
      { status: 500 },
    );
  }
}
