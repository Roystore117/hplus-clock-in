import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createHash } from "crypto";

// 生パスワードを cookie に入れないため、環境変数のソルト付きで SHA-256 ハッシュ化したものを保存・検証する
// salt はコードに含めない（公開リポジトリで漏れないように環境変数で管理）
export function buildAdminToken(): string {
  const salt = process.env.ADMIN_TOKEN_SALT;
  if (!salt) throw new Error("ADMIN_TOKEN_SALT 環境変数が未設定です");
  return createHash("sha256")
    .update(process.env.ADMIN_PASSWORD! + salt)
    .digest("hex");
}

export function verifyAdminCookie(req: NextRequest): NextResponse | null {
  const token = req.cookies.get("admin_token")?.value;
  if (!token || token !== buildAdminToken()) {
    return NextResponse.json({ error: "認証が必要です" }, { status: 403 });
  }
  return null;
}

// next/headers の cookies() を使うルート向け
export async function isAdminAuthenticated(): Promise<boolean> {
  const cookieStore = await cookies();
  return cookieStore.get("admin_token")?.value === buildAdminToken();
}
