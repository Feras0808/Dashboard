
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

async function verifyAdmin(request: NextRequest) {
  const token = request.headers
    .get("authorization")
    ?.match(/^Bearer\s+(.+)$/i)?.[1];

  if (!token) {
    return {
      error: NextResponse.json(
        { error: "Please sign in as an administrator." },
        { status: 401 }
      ),
      admin: null,
    };
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error("Supabase URL or anon key is missing.");
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
    return {
      error: NextResponse.json(
        { error: "Your session is invalid. Please sign in again." },
        { status: 401 }
      ),
      admin: null,
    };
  }

  const admin = getSupabaseAdmin();

  const { data: adminProfile, error: adminProfileError } = await admin
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (adminProfileError) {
    throw new Error(
      `Unable to verify administrator role: ${adminProfileError.message}`
    );
  }

  if (adminProfile?.role !== "admin") {
    return {
      error: NextResponse.json(
        { error: "Administrator access is required." },
        { status: 403 }
      ),
      admin: null,
    };
  }

  return { error: null, admin };
}

// GET: List existing employees, including emails from Supabase Auth.
export async function GET(request: NextRequest) {
  try {
    const { error: authorizationError, admin } =
      await verifyAdmin(request);

    if (authorizationError || !admin) {
      return authorizationError!;
    }

    const { data: profiles, error: profilesError } = await admin
      .from("profiles")
      .select("id, full_name, company_id, department_id")
      .eq("role", "employee")
      .order("full_name", { ascending: true });

    if (profilesError) {
      throw new Error(
        `Could not load employee profiles: ${profilesError.message}`
      );
    }

    const employees = await Promise.all(
      (profiles ?? []).map(async (profile) => {
        const {
          data: { user: authUser },
          error: authUserError,
        } = await admin.auth.admin.getUserById(profile.id);

        if (authUserError) {
          console.error(
            `Could not retrieve Auth account ${profile.id}:`,
            authUserError.message
          );
        }

        return {
          id: profile.id,
          full_name: profile.full_name,
          email: authUser?.email ?? "",
          company_id: profile.company_id,
          department_id: profile.department_id,
        };
      })
    );

    return NextResponse.json(
      { employees },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  } catch (error) {
    console.error("Employee list API failed:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Could not load employees.",
      },
      { status: 500 }
    );
  }
}

// POST: Create a new employee.
export async function POST(request: NextRequest) {
  let createdUserId: string | null = null;

  try {
    const { error: authorizationError, admin } =
      await verifyAdmin(request);

    if (authorizationError || !admin) {
      return authorizationError!;
    }

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

    const { data: department, error: departmentError } = await admin
      .from("departments")
      .select("id")
      .eq("id", departmentId)
      .maybeSingle();

    if (departmentError) {
      throw new Error(
        `Department lookup failed: ${departmentError.message}`
      );
    }

    if (!department) {
      return NextResponse.json(
        { error: "The selected department was not found." },
        { status: 400 }
      );
    }

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
      throw new Error(
        `Profile creation failed: ${profileError.message}`
      );
    }

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

    if (createdUserId) {
      try {
        const admin = getSupabaseAdmin();
        const { error: deleteError } =
          await admin.auth.admin.deleteUser(createdUserId);

        if (deleteError) {
          console.error(
            "Failed to clean up newly created Auth user:",
            deleteError.message
          );
        }
      } catch (cleanupError) {
        console.error("Auth-user cleanup failed:", cleanupError);
      }
    }

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "An unexpected server error occurred.",
      },
      { status: 500 }
    );
  }
}
