import { NextRequest, NextResponse } from "next/server";
import { registerTimestamp, StampType } from "@/lib/notion";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { pageId, employeeName, type } = body as {
      pageId: string;
      employeeName: string;
      type: StampType;
    };

    if (!pageId || !employeeName || !type) {
      return NextResponse.json({ error: "パラメータ不足" }, { status: 400 });
    }
    if (type !== "出勤" && type !== "退勤") {
      return NextResponse.json({ error: "不正な打刻種別" }, { status: 400 });
    }

    await registerTimestamp(pageId, employeeName, type);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    const detail = error?.body ?? error?.message ?? String(error);
    console.error("打刻登録エラー:", detail);
    return NextResponse.json(
      { error: "打刻の登録に失敗しました", detail },
      { status: 500 }
    );
  }
}
