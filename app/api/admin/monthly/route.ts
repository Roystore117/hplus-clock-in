import { NextRequest, NextResponse } from "next/server";
import { getMonthlyRecords } from "@/lib/notion";
import { isAdminAuthenticated } from "@/lib/adminAuth";

export async function GET(req: NextRequest) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const { searchParams } = req.nextUrl;
  const employeeId = searchParams.get("employeeId");
  const year = parseInt(searchParams.get("year") ?? "", 10);
  const month = parseInt(searchParams.get("month") ?? "", 10);

  if (!employeeId || isNaN(year) || isNaN(month)) {
    return NextResponse.json({ error: "Bad Request" }, { status: 400 });
  }

  try {
    const records = await getMonthlyRecords(employeeId, year, month);
    return NextResponse.json(records);
  } catch (e) {
    return NextResponse.json({ error: "Failed to fetch" }, { status: 500 });
  }
}
