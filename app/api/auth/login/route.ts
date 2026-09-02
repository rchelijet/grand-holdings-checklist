import { NextResponse } from "next/server";
import { authenticateUser } from "@/lib/auth";
import { createSession, setSessionCookie } from "@/lib/session";

export async function POST(request: Request) {
  const body = await request.json();
  const { email, password } = body;

  if (!email || !password) {
    return NextResponse.json(
      { error: "Email and password are required" },
      { status: 400 }
    );
  }

  const result = await authenticateUser(email, password);
  if (!result.ok) {
    const message =
      result.reason === "inactive"
        ? "This account has been deactivated. Contact an administrator."
        : "Invalid credentials";
    return NextResponse.json({ error: message }, { status: 401 });
  }

  const token = await createSession(result.user);
  await setSessionCookie(token);

  return NextResponse.json({ user: result.user });
}
