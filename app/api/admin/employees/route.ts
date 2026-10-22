
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export async function POST(request: NextRequest) {
  let createdUserId: string | null = null;

  try {
    // 1. Verify the signed-in user.
    const token = request.headers
      .get("authorization")
      ?.match(/^Bearer\s+(.+)$/i)?.[1];

    if (!token) {
      return NextResponse.json(
        { error: "Please sign in as an administrator." },
        { status: 401 }
      );
    }

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!url || !anonKey) {
      throw new Error("Supabase URL or anon key is missing from environment variables.");
    }

    const verifier = createClient(url, anonKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    const {
      data: { user },
      error: authError,
    } = await verifier.auth.getUser(token);

    if (authError || !user) {
      return NextResponse.json(
        { error: "Your session is invalid. Please sign in again." },
        { status: 401 }
      );
    }

    // 2. Use the server-only admin client.
    const admin = getSupabaseAdmin();

    // 3. Only administrators can create employees.
    const { data: adminProfile, error: adminProfileError } = await admin
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();

    if (adminProfileError) {
      console.error("Admin profile lookup failed:", adminProfileError);
      throw new Error(`Unable to verify administrator role: ${adminProfileError.message}`);
    }

    if (adminProfile?.role !== "admin") {
      return NextResponse.json(
        { error: "Administrator access is required." },
        { status: 403 }
      );
    }

    // 4. Validate the request.
    const body = await request.json();

    const fullName =
      typeof body.fullName === "string" ? body.fullName.trim() : "";

    const email =
      typeof body.email === "string"
        ? body.email.trim().toLowerCase()
        : "";

    const password =
      typeof body.password === "string" ? body.password : "";

    const companyId =
      typeof body.companyId === "string" ? body.companyId : "";

    const departmentId =
      typeof body.departmentId === "string" ? body.departmentId : "";

    if (!fullName || fullName.length > 150) {
      return NextResponse.json(
        { error: "Enter a valid employee name." },
        { status: 400 }
      );
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
      return NextResponse.json(
        { error: "Enter a valid email address." },
        { status: 400 }
      );
    }

    if (password.length < 6 || password.length > 72) {
      return NextResponse.json(
        { error: "Temporary passwords must be 6–72 characters." },
        { status: 400 }
      );
    }

    if (!companyId || !departmentId) {
      return NextResponse.json(
        { error: "Select a company and department." },
        { status: 400 }
      );
    }

    // 5. Verify that the selected company exists.
    const { data: company, error: companyError } = await admin
      .from("companies")
      .select("id")
      .eq("id", companyId)
      .maybeSingle();

    if (companyError) {
      throw new Error(`Company lookup failed: ${companyError.message}`);
    }

    if (!company) {
      return NextResponse.json(
        { error: "The selected company was not found." },
        { status: 400 }
      );
    }

    // 6. Verify the department using the columns that actually exist.
    // Your departments table does not have a company_id column.
    const { data: department, error: departmentError } = await admin
      .from("departments")
      .select("id")
      .eq("id", departmentId)
      .maybeSingle();

    if (departmentError) {
      throw new Error(`Department lookup failed: ${departmentError.message}`);
    }

    if (!department) {
      return NextResponse.json(
        { error: "The selected department was not found." },
        { status: 400 }
      );
    }

    // 7. Create the employee's Supabase Auth account.
    const {
      data: { user: newUser },
      error: createError,
    } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: fullName,
      },
      app_metadata: {
        account_type: "employee",
      },
    });

    if (createError) {
      const message = createError.message.toLowerCase();

      if (
        message.includes("already") ||
        message.includes("registered") ||
        message.includes("exists")
      ) {
        return NextResponse.json(
          { error: "An account with this email may already exist." },
          { status: 409 }
        );
      }

      return NextResponse.json(
        { error: createError.message },
        { status: 400 }
      );
    }

    if (!newUser) {
      throw new Error("Supabase did not return the created account.");
    }

    createdUserId = newUser.id;

    // 8. Create the linked profile using the same UUID.
    // If your profiles table lacks must_change_password, see the SQL note below.
    const { error: profileError } = await admin
      .from("profiles")
      .upsert(
        {
          id: newUser.id,
          full_name: fullName,
          role: "employee",
          company_id: companyId,
          department_id: departmentId,
          must_change_password: true,
        },
        { onConflict: "id" }
      );

    if (profileError) {
      throw new Error(`Profile creation failed: ${profileError.message}`);
    }

    // 9. Return success.
    createdUserId = null;

    return NextResponse.json(
      {
        message: "Employee created successfully.",
        employee: {
          id: newUser.id,
          fullName,
          email,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Employee creation failed:", error);

    // Remove the Auth user if profile creation failed.
    if (createdUserId) {
      try {
        const admin = getSupabaseAdmin();
        const { error: deleteError } =
          await admin.auth.admin.deleteUser(createdUserId);

        if (deleteError) {
          console.error(
            "Failed to clean up the newly created Auth user:",
            deleteError
          );
        }
      } catch (cleanupError) {
        console.error("Auth-user cleanup failed:", cleanupError);
      }
    }

    const message =
      error instanceof Error
        ? error.message
        : "An unexpected server error occurred.";

    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
