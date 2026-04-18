import { NextRequest, NextResponse } from "next/server";
import { verifyAdminCookie } from "@/lib/adminAuth";

export async function GET(req: NextRequest) {
  const authError = verifyAdminCookie(req);
  if (authError) return authError;
  return NextResponse.json({ authenticated: true });
}
