import { NextResponse } from "next/server";
import { getAllEmployees } from "@/lib/notion";

export async function GET() {
  try {
    const employees = await getAllEmployees();
    return NextResponse.json(employees);
  } catch (error) {
    console.error("従業員取得エラー:", error);
    return NextResponse.json(
      { error: "従業員データの取得に失敗しました" },
      { status: 500 }
    );
  }
}
