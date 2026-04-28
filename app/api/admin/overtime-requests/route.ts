import { NextRequest, NextResponse } from "next/server";
import { getOvertimeRequests } from "@/lib/notion";
import { verifyAdminCookie } from "@/lib/adminAuth";

export async function GET(req: NextRequest) {
  const authError = verifyAdminCookie(req);
  if (authError) return authError;

  const status = req.nextUrl.searchParams.get("status") ?? undefined;

  try {
    const requests = await getOvertimeRequests(status ? { status } : undefined);
    return NextResponse.json(requests);
  } catch (e: any) {
    const detail = e?.body ?? e?.message ?? String(e);
    return NextResponse.json({ error: "取得に失敗しました", detail }, { status: 500 });
  }
}
