/**
 * 管理者API用fetchラッパー
 * - 403が返ったらログイン画面にリダイレクト
 * - 一時的なエラー（ネットワーク・5xx）は1回自動リトライ
 */
export async function adminFetch(
  url: string,
  options?: RequestInit,
  retries = 1
): Promise<Response> {
  try {
    const res = await fetch(url, options);

    // 403 は認証切れ。リトライ不要で /admin にリロード（ログインモーダルが表示される）
    if (res.status === 403) {
      window.location.href = "/admin";
      throw new Error("Unauthorized");
    }

    // 5xx は一時的なサーバーエラーの可能性。リトライ対象
    if (res.status >= 500 && retries > 0) {
      await new Promise((r) => setTimeout(r, 500));
      return adminFetch(url, options, retries - 1);
    }

    return res;
  } catch (e: any) {
    // ネットワークエラー等：認証切れは素通し、それ以外はリトライ
    if (e?.message === "Unauthorized") throw e;
    if (retries > 0) {
      await new Promise((r) => setTimeout(r, 500));
      return adminFetch(url, options, retries - 1);
    }
    throw e;
  }
}
