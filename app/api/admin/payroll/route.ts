import { NextRequest, NextResponse } from "next/server";
import { getPayrollSettings, updatePayrollSettings } from "@/lib/notion";
import { verifyAdminCookie } from "@/lib/adminAuth";

export async function GET(req: NextRequest) {
  const authError = verifyAdminCookie(req);
  if (authError) return authError;

  const pageId = req.nextUrl.searchParams.get("pageId");
  if (!pageId) return NextResponse.json({ error: "pageId is required" }, { status: 400 });

  try {
    const settings = await getPayrollSettings(pageId);
    return NextResponse.json(settings);
  } catch (e: any) {
    const detail = e?.body ?? e?.message ?? String(e);
    return NextResponse.json({ error: "取得に失敗しました", detail }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  const authError = verifyAdminCookie(req);
  if (authError) return authError;

  try {
    const { id, startTime, endTime, breakHours, deemedOvertimeHours, alertThreshold } = await req.json();
    await updatePayrollSettings(id, { startTime, endTime, breakHours, deemedOvertimeHours, alertThreshold });
    return NextResponse.json({ success: true });
  } catch (e: any) {
    const detail = e?.body ?? e?.message ?? String(e);
    return NextResponse.json({ error: "保存に失敗しました", detail }, { status: 500 });
  }
}
