import { NextRequest, NextResponse } from "next/server";
import { buildAdminToken } from "@/lib/adminAuth";

export async function POST(req: NextRequest) {
  const { password } = await req.json();

  if (password !== process.env.ADMIN_PASSWORD) {
    return NextResponse.json({ error: "パスワードが違います" }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set("admin_token", buildAdminToken(), {
    httpOnly: true,
    sameSite: "strict",
    path: "/",
    maxAge: 60 * 60 * 24, // 1日
    secure: process.env.NODE_ENV === "production",
  });
  return res;
}
