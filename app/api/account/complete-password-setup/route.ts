
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export async function POST(request: NextRequest) {
  try {
    const token = request.headers
      .get("authorization")
      ?.match(/^Bearer\s+(.+)$/i)?.[1];

    if (!token) {
      return NextResponse.json({ error: "Sign in first." }, { status: 401 });
    }

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!url || !anonKey) {
      throw new Error("Supabase is not configured.");
    }

    const verifier = createClient(url, anonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const {
      data: { user },
      error,
    } = await verifier.auth.getUser(token);

    if (error || !user) {
      return NextResponse.json({ error: "Invalid session." }, { status: 401 });
    }

    const admin = getSupabaseAdmin();

    const { data: profile, error: profileError } = await admin
      .from("profiles")
      .select("role, must_change_password")
      .eq("id", user.id)
      .single();

    if (profileError || !profile) {
      return NextResponse.json(
        { error: "Employee profile not found." },
        { status: 404 }
      );
    }

    if (profile.role !== "employee" || !profile.must_change_password) {
      return NextResponse.json(
        { error: "No temporary-password setup is pending." },
        { status: 400 }
      );
    }

    const { error: updateError } = await admin
      .from("profiles")
      .update({ must_change_password: false })
      .eq("id", user.id)
      .eq("must_change_password", true);

    if (updateError) throw updateError;

    return NextResponse.json({ message: "Password setup completed." });
  } catch (error) {
    console.error("Password setup completion failed:", error);

    return NextResponse.json(
      { error: "Unable to complete password setup." },
      { status: 500 }
    );
  }
}
