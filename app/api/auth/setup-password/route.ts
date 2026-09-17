import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabase } from "@/lib/supabase-admin";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const expectedPin = process.env.APP_PIN;
    if (!expectedPin) {
      return NextResponse.json(
        { error: "APP_PIN is not configured on the server." },
        { status: 500 },
      );
    }

    const body = await request.json();
    const email = String(body?.email || "").trim().toLowerCase();
    const password = String(body?.password || "");
    const pin = String(body?.pin || "");

    if (!email || !email.includes("@")) {
      return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
    }

    if (password.length < 8) {
      return NextResponse.json(
        { error: "Password must be at least 8 characters." },
        { status: 400 },
      );
    }

    if (pin !== expectedPin) {
      return NextResponse.json({ error: "Invalid private setup PIN." }, { status: 401 });
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

    if (existingUser) {
      const { error } = await supabase.auth.admin.updateUserById(existingUser.id, {
        password,
        email_confirm: true,
      });
      if (error) throw error;

      return NextResponse.json({
        ok: true,
        message: "Password created. You can sign in now.",
      });
    }

    if (!allowedEmail) {
      return NextResponse.json(
        {
          error:
            "No existing account was found for this email. Configure ALLOWED_USER_EMAIL before creating a new account.",
        },
        { status: 404 },
      );
    }

    const { error: createError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

    if (createError) throw createError;

    return NextResponse.json({
      ok: true,
      message: "Account and password created. You can sign in now.",
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Password setup failed." },
      { status: 500 },
    );
  }
}
