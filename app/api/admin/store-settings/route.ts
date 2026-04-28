import { NextRequest, NextResponse } from "next/server";
import { getStoreSettings, updateStoreClosingDay } from "@/lib/notion";
import { isAdminAuthenticated } from "@/lib/adminAuth";

export async function GET() {
  if (!(await isAdminAuthenticated())) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  try {
    return NextResponse.json(await getStoreSettings());
  } catch {
    return NextResponse.json({ error: "Failed to fetch" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  if (!(await isAdminAuthenticated())) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  const { pageId, closingDay } = await req.json();
  if (!pageId || closingDay === undefined) {
    return NextResponse.json({ error: "Bad Request" }, { status: 400 });
  }
  try {
    await updateStoreClosingDay(pageId, closingDay);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Failed to update" }, { status: 500 });
  }
}
