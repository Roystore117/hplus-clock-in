import { NextRequest, NextResponse } from "next/server";
import { approveOvertimeRequest, rejectOvertimeRequest } from "@/lib/notion";
import { verifyAdminCookie } from "@/lib/adminAuth";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authError = verifyAdminCookie(req);
  if (authError) return authError;

  const { id } = await params;
  const { action } = await req.json() as { action: "approve" | "reject" };

  try {
    if (action === "approve") {
      await approveOvertimeRequest(id);
    } else if (action === "reject") {
      await rejectOvertimeRequest(id);
    } else {
      return NextResponse.json({ error: "actionは approve または reject" }, { status: 400 });
    }
    return NextResponse.json({ success: true });
  } catch (e: any) {
    const detail = e?.body ?? e?.message ?? String(e);
    return NextResponse.json({ error: "処理に失敗しました", detail }, { status: 500 });
  }
}
