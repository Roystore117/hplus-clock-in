import { Client } from "@notionhq/client";

const notion = new Client({ auth: process.env.NOTION_API_KEY });

export type Employee = {
  id: string;
  name: string;
};

export type StampType = "出勤" | "退勤";

/** 従業員マスタを昇順で全件取得 */
export async function getAllEmployees(): Promise<Employee[]> {
  const response = await notion.databases.query({
    database_id: process.env.EMPLOYEE_DB_ID!,
    sorts: [{ property: "従業員ID", direction: "ascending" }],
  });

  return response.results
    .map((page: any) => {
      let name = "不明";
      let status = "不明";
      try {
        name = page.properties["名前"].title[0].text.content;
      } catch {}
      try {
        status = page.properties["ステータス"].status.name;
      } catch {}
      return { id: page.id, name, status };
    })
    .filter((emp) => emp.status !== "退職"); // 退職者を除外
}

/**
 * 給与計算用の丸め処理
 * - 打刻時刻を「時間の切り上げ」に丸める
 *   例: 8:20 → 9:00 / 9:00 → 9:00（ちょうどはそのまま）
 */
export function roundUpToHour(date: Date): Date {
  const rounded = new Date(date);
  if (rounded.getMinutes() === 0 && rounded.getSeconds() === 0) {
    return rounded; // すでに正時ならそのまま
  }
  rounded.setHours(rounded.getHours() + 1);
  rounded.setMinutes(0);
  rounded.setSeconds(0);
  rounded.setMilliseconds(0);
  return rounded;
}

/** 打刻ログをNotionに書き込む */
export async function registerTimestamp(
  pageId: string,
  employeeName: string,
  type: StampType
): Promise<void> {
  const now = new Date();
  const jstNow = new Date(now.toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" }));

  // タイトル用フォーマット
  const pad = (n: number) => String(n).padStart(2, "0");
  const titleText = `${jstNow.getFullYear()}-${pad(jstNow.getMonth() + 1)}-${pad(jstNow.getDate())} ${pad(jstNow.getHours())}:${pad(jstNow.getMinutes())} ${employeeName} ${type}`;

  // 給与計算用: 切り上げ丸め
  const roundedForPayroll = roundUpToHour(jstNow);

  const baseProperties: Record<string, any> = {
    タイトル: {
      title: [{ text: { content: titleText } }],
    },
    日付: {
      date: { start: now.toISOString() },
    },
    給与計算用日付: {
      date: { start: roundedForPayroll.toISOString() },
    },
    打刻種別: {
      select: { name: type },
    },
    従業員: {
      relation: [{ id: pageId }],
    },
  };

  // まず全プロパティで試み、「給与計算用日付」が未作成の場合はスキップして再試行
  try {
    await notion.pages.create({
      parent: { database_id: process.env.DATABASE_ID! },
      properties: baseProperties,
    });
  } catch (err: any) {
    const msg: string = err?.body ?? err?.message ?? "";
    if (msg.includes("給与計算用日付") || msg.includes("payroll") || msg.includes("property")) {
      console.warn("給与計算用日付プロパティが見つからないためスキップして再試行します");
      const { 給与計算用日付: _omit, ...propertiesWithout } = baseProperties;
      await notion.pages.create({
        parent: { database_id: process.env.DATABASE_ID! },
        properties: propertiesWithout,
      });
    } else {
      throw err;
    }
  }
}
