import { NextResponse } from "next/server";

// PayU redirects here when a payment fails or is cancelled — no
// grant to make, and no DB write needed, just a friendly redirect.
// Still parses the form data (rather than ignoring the body) so a
// future addition — logging failed attempts, say — has it available.
export async function POST(request) {
  const origin = new URL(request.url).origin;
  try {
    await request.formData();
  } catch {
    // a malformed or empty body here is harmless — still redirect normally
  }
  return NextResponse.redirect(`${origin}/account?payment=failed`);
}
