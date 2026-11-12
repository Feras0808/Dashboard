
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
    try {
        const authorization = request.headers.get("authorization");
        const token = authorization?.replace(/^Bearer\s+/i, "");

        if (!token) {
            return NextResponse.json(
                { error: "You must be logged in." },
                { status: 401 }
            );
        }

        const body = await request.json();
        const { employeeId, newPassword } = body;

        if (!employeeId || typeof employeeId !== "string") {
            return NextResponse.json(
                { error: "Employee ID is required." },
                { status: 400 }
            );
        }

        if (
            typeof newPassword !== "string" ||
            newPassword.length < 8 ||
            newPassword.length > 72
        ) {
            return NextResponse.json(
                { error: "Password must be between 8 and 72 characters." },
                { status: 400 }
            );
        }

        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
        const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
        const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

        if (!serviceRoleKey) {
            return NextResponse.json(
                { error: "Server configuration is missing." },
                { status: 500 }
            );
        }

        // Verify the current user's access token.
        const authClient = createClient(supabaseUrl, anonKey, {
            auth: {
                autoRefreshToken: false,
                persistSession: false,
            },
        });

        const {
            data: { user: adminUser },
            error: authError,
        } = await authClient.auth.getUser(token);

        if (authError || !adminUser) {
            return NextResponse.json(
                { error: "Your session is invalid. Please log in again." },
                { status: 401 }
            );
        }

        // Use the service-role client only on the server.
        const adminClient = createClient(supabaseUrl, serviceRoleKey, {
            auth: {
                autoRefreshToken: false,
                persistSession: false,
            },
        });

        // Verify that the requesting user is an admin.
        const { data: profile, error: profileError } = await adminClient
            .from("profiles")
            .select("role")
            .eq("id", adminUser.id)
            .maybeSingle();

        if (profileError || profile?.role !== "admin") {
            return NextResponse.json(
                { error: "You are not authorized to reset passwords." },
                { status: 403 }
            );
        }

        // Prevent an admin from accidentally resetting their own password
        // through the employee-management action.
        if (employeeId === adminUser.id) {
            return NextResponse.json(
                { error: "Use your own account settings to change your password." },
                { status: 400 }
            );
        }

        // Confirm that the target is an employee, not another admin.
        const { data: employeeProfile, error: employeeError } =
            await adminClient
                .from("profiles")
                .select("id, role")
                .eq("id", employeeId)
                .maybeSingle();

        if (employeeError || !employeeProfile) {
            return NextResponse.json(
                { error: "Employee account was not found." },
                { status: 404 }
            );
        }

        if (employeeProfile.role !== "employee") {
            return NextResponse.json(
                { error: "You can only reset employee passwords." },
                { status: 403 }
            );
        }

        const { error: updateError } =
            await adminClient.auth.admin.updateUserById(employeeId, {
                password: newPassword,
            });

        if (updateError) {
            console.error("Password reset failed:", updateError.message);

            return NextResponse.json(
                { error: "Could not update the employee password." },
                { status: 500 }
            );
        }

        return NextResponse.json({
            success: true,
            message: "Employee password updated successfully.",
        });
    } catch (error) {
        console.error("Reset employee password error:", error);

        return NextResponse.json(
            { error: "An unexpected error occurred." },
            { status: 500 }
        );
    }
}
