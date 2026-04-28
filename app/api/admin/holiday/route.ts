import { NextRequest, NextResponse } from "next/server";
import { createHolidayRecord, deleteHolidayRecord, getMonthHolidayRecords } from "@/lib/notion";
import { isAdminAuthenticated } from "@/lib/adminAuth";

// 指定月の公休・有給一覧取得
export async function GET(req: NextRequest) {
  if (!(await isAdminAuthenticated())) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  const { searchParams } = new URL(req.url);
  const year = Number(searchParams.get("year"));
  const month = Number(searchParams.get("month"));
  if (!year || !month) return NextResponse.json({ error: "Bad Request" }, { status: 400 });
  try {
    return NextResponse.json(await getMonthHolidayRecords(year, month));
  } catch {
    return NextResponse.json({ error: "Failed to fetch" }, { status: 500 });
  }
}

// 公休登録
export async function POST(req: NextRequest) {
  if (!(await isAdminAuthenticated())) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  const { employeePageId, employeeName, date, type } = await req.json();
  if (!employeePageId || !employeeName || !date) {
    return NextResponse.json({ error: "Bad Request" }, { status: 400 });
  }
  try {
    const workType: "公休" | "有給" = type === "有給" ? "有給" : "公休";
    const pageId = await createHolidayRecord(employeePageId, employeeName, date, workType);
    return NextResponse.json({ pageId });
  } catch {
    return NextResponse.json({ error: "Failed to create" }, { status: 500 });
  }
}

// 公休削除
export async function DELETE(req: NextRequest) {
  if (!(await isAdminAuthenticated())) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  const { pageId } = await req.json();
  if (!pageId) return NextResponse.json({ error: "Bad Request" }, { status: 400 });
  try {
    await deleteHolidayRecord(pageId);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Failed to delete" }, { status: 500 });
  }
}
