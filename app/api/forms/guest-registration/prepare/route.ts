import { NextResponse } from "next/server";
import { prepareGuestRegistration } from "@/lib/form-submissions";
import type { GuestRegistrationData } from "@/lib/guest-registration";
import { getSessionUser } from "@/lib/session";
import { canAccessFacility } from "@/lib/tasks";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { facilityId, data, status, id } = body as {
    facilityId?: number;
    data?: GuestRegistrationData;
    status?: "draft" | "prepared";
    id?: number;
  };

  if (!facilityId || !data) {
    return NextResponse.json(
      { error: "Property and form data are required." },
      { status: 400 }
    );
  }

  if (!canAccessFacility(user, facilityId)) {
    return NextResponse.json(
      { error: "You do not have access to this property." },
      { status: 403 }
    );
  }

  const saveStatus = status === "draft" ? "draft" : "prepared";

  try {
    const submission = prepareGuestRegistration(
      user,
      facilityId,
      data,
      saveStatus,
      id
    );
    return NextResponse.json({ submission }, { status: id ? 200 : 201 });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to save preparation.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
