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

/** 従業員マスタを全件取得（管理者画面用・退職者含む） */
export async function getAllEmployeesAdmin(): Promise<EmployeeAdmin[]> {
  const response = await notion.databases.query({
    database_id: process.env.EMPLOYEE_DB_ID!,
    sorts: [{ property: "従業員ID", direction: "ascending" }],
  });

  return response.results.flatMap((page: any) => {
    try {
      const name = page.properties["名前"].title[0]?.text.content ?? "不明";
      const employeeId = page.properties["従業員ID"]?.rich_text?.[0]?.text?.content ?? "";
      const status = page.properties["ステータス"]?.status?.name ?? "不明";
      return [{ id: page.id, name, employeeId, status }];
    } catch {
      return [];
    }
  });
}

/** 従業員を更新 */
export async function updateEmployee(id: string, name: string, status: string): Promise<void> {
  await notion.pages.update({
    page_id: id,
    properties: {
      名前: { title: [{ text: { content: name } }] },
      ステータス: { status: { name: status } },
    },
  });
}

/** 従業員を新規追加 */
export async function createEmployee(name: string, employeeId: string, status: string): Promise<EmployeeAdmin> {
  const page = await notion.pages.create({
    parent: { database_id: process.env.EMPLOYEE_DB_ID! },
    properties: {
      名前: { title: [{ text: { content: name } }] },
      従業員ID: { rich_text: [{ text: { content: employeeId } }] },
      ステータス: { status: { name: status } },
    },
  }) as any;
  return { id: page.id, name, employeeId, status };
}

/** 保健師の一言を全件取得（有効=trueのみ・打刻画面用） */
export async function getAllTips(): Promise<string[]> {
  const response = await notion.databases.query({
    database_id: process.env.TIPS_DB_ID!,
    filter: { property: "有効", checkbox: { equals: true } },
  });

  return response.results.flatMap((page: any) => {
    try {
      const text = page.properties["一言"].title[0].text.content.replace(/\\n/g, "\n");
      return text ? [text] : [];
    } catch {
      return [];
    }
  });
}

export type Tip = {
  id: string;
  text: string;
  enabled: boolean;
};

export type EmployeeAdmin = {
  id: string;
  name: string;
  employeeId: string;
  status: string;
};

/** 保健師の一言を全件取得（有効・無効含む・管理者画面用） */
export async function getAllTipsAdmin(): Promise<Tip[]> {
  const response = await notion.databases.query({
    database_id: process.env.TIPS_DB_ID!,
    sorts: [{ property: "有効", direction: "descending" }],
  });

  return response.results.flatMap((page: any) => {
    try {
      const text = (page.properties["一言"].title[0]?.text.content ?? "").replace(/\\n/g, "\n");
      const enabled = page.properties["有効"].checkbox ?? false;
      return [{ id: page.id, text, enabled }];
    } catch {
      return [];
    }
  });
}

/** 保健師の一言を新規追加 */
export async function createTip(text: string, enabled: boolean): Promise<Tip> {
  const page = await notion.pages.create({
    parent: { database_id: process.env.TIPS_DB_ID! },
    properties: {
      一言: { title: [{ text: { content: text } }] },
      有効: { checkbox: enabled },
    },
  }) as any;
  return { id: page.id, text, enabled };
}

/** 保健師の一言を更新 */
export async function updateTip(id: string, text: string, enabled: boolean): Promise<void> {
  await notion.pages.update({
    page_id: id,
    properties: {
      一言: { title: [{ text: { content: text } }] },
      有効: { checkbox: enabled },
    },
  });
}

export type PayrollSettings = {
  id: string;
  startTime: string;        // "HH:MM"
  endTime: string;          // "HH:MM"
  deemedOvertimeHours: number;
  alertThreshold: number;
  autoSwitch: boolean;      // 時刻で出退勤デフォルトを自動切替
  switchTime: string;       // "HH:MM" 切替時刻
};

const PAYROLL_SETTINGS_DEFAULTS: Omit<PayrollSettings, "id"> = {
  startTime: "09:00",
  endTime: "18:00",
  deemedOvertimeHours: 30,
  alertThreshold: 80,
  autoSwitch: true,
  switchTime: "12:00",
};

/** 給与計算設定を取得（レコードがなければデフォルト値を返す） */
export async function getPayrollSettings(): Promise<PayrollSettings> {
  const response = await notion.databases.query({
    database_id: process.env.PAYROLL_SETTINGS_DB_ID!,
    page_size: 1,
  });

  if (response.results.length === 0) {
    return { id: "", ...PAYROLL_SETTINGS_DEFAULTS };
  }

  const page = response.results[0] as any;
  try {
    return {
      id: page.id,
      startTime:            page.properties["始業標準時刻"]?.rich_text?.[0]?.text?.content ?? PAYROLL_SETTINGS_DEFAULTS.startTime,
      endTime:              page.properties["終業標準時刻"]?.rich_text?.[0]?.text?.content ?? PAYROLL_SETTINGS_DEFAULTS.endTime,
      deemedOvertimeHours:  page.properties["みなし残業時間"]?.number ?? PAYROLL_SETTINGS_DEFAULTS.deemedOvertimeHours,
      alertThreshold:       page.properties["アラート閾値"]?.number   ?? PAYROLL_SETTINGS_DEFAULTS.alertThreshold,
      autoSwitch:           page.properties["自動切替"]?.checkbox     ?? PAYROLL_SETTINGS_DEFAULTS.autoSwitch,
      switchTime:           page.properties["切替時刻"]?.rich_text?.[0]?.text?.content ?? PAYROLL_SETTINGS_DEFAULTS.switchTime,
    };
  } catch {
    return { id: page.id, ...PAYROLL_SETTINGS_DEFAULTS };
  }
}

/** 給与計算設定を更新 */
export async function updatePayrollSettings(
  id: string,
  settings: Omit<PayrollSettings, "id">
): Promise<void> {
  await notion.pages.update({
    page_id: id,
    properties: {
      始業標準時刻:       { rich_text: [{ text: { content: settings.startTime } }] },
      終業標準時刻:       { rich_text: [{ text: { content: settings.endTime } }] },
      みなし残業時間:     { number: settings.deemedOvertimeHours },
      アラート閾値:       { number: settings.alertThreshold },
      自動切替:           { checkbox: settings.autoSwitch },
      切替時刻:           { rich_text: [{ text: { content: settings.switchTime } }] },
    },
  });
}

export type PunchRecord = {
  type: StampType;
  timeStr: string; // "HH:MM" JST
};

/** 今日（JST）の従業員打刻を取得 */
export async function getTodayPunches(employeeId: string): Promise<PunchRecord[]> {
  const JST_OFFSET_MS = 9 * 60 * 60 * 1000;
  const now = new Date();
  const jstNow = new Date(now.getTime() + JST_OFFSET_MS);
  const jstMidnightUTC = new Date(
    Date.UTC(jstNow.getUTCFullYear(), jstNow.getUTCMonth(), jstNow.getUTCDate()) - JST_OFFSET_MS
  );
  const nextMidnightUTC = new Date(jstMidnightUTC.getTime() + 24 * 60 * 60 * 1000);

  const response = await notion.databases.query({
    database_id: process.env.DATABASE_ID!,
    filter: {
      and: [
        { property: "従業員", relation: { contains: employeeId } },
        { property: "実打刻", date: { on_or_after: jstMidnightUTC.toISOString() } },
        { property: "実打刻", date: { before: nextMidnightUTC.toISOString() } },
      ],
    },
    sorts: [{ property: "実打刻", direction: "ascending" }],
  });

  const pad = (n: number) => String(n).padStart(2, "0");
  return response.results.flatMap((page: any) => {
    try {
      const type = page.properties["打刻種別"]?.select?.name as StampType;
      const isoStr = page.properties["実打刻"]?.date?.start;
      if (!type || !isoStr) return [];
      const jstDate = new Date(new Date(isoStr).getTime() + JST_OFFSET_MS);
      const timeStr = `${pad(jstDate.getUTCHours())}:${pad(jstDate.getUTCMinutes())}`;
      return [{ type, timeStr }];
    } catch {
      return [];
    }
  });
}

/** 時間外申請をNotionに書き込む */
export async function createOvertimeRequest(data: {
  employeeName: string;
  applyDate: string;
  earlyArrival: boolean;
  earlyTime: string;
  earlyReason: string;
  overtime: boolean;
  overtimeTime: string;
  overtimeReason: string;
}): Promise<void> {
  const title = `${data.applyDate} ${data.employeeName} 時間外申請`;
  await notion.pages.create({
    parent: { database_id: process.env.OVERTIME_REQUEST_DB_ID! },
    properties: {
      タイトル:   { title: [{ text: { content: title } }] },
      従業員名:   { rich_text: [{ text: { content: data.employeeName } }] },
      申請日:     { date: { start: data.applyDate } },
      早出申請:   { checkbox: data.earlyArrival },
      早出時刻:   { rich_text: [{ text: { content: data.earlyTime } }] },
      早出理由:   { rich_text: [{ text: { content: data.earlyReason } }] },
      残業申請:   { checkbox: data.overtime },
      残業時刻:   { rich_text: [{ text: { content: data.overtimeTime } }] },
      残業理由:   { rich_text: [{ text: { content: data.overtimeReason } }] },
      ステータス: { status: { name: "未対応" } },
    },
  });
}

/** 打刻ログをNotionに書き込む */
export async function registerTimestamp(
  pageId: string,
  employeeName: string,
  type: StampType,
  mockTime?: string,          // "HH:MM" 形式（デバッグ用）
  standardStartTime?: string, // "HH:MM" 形式（給与計算設定から）
  standardEndTime?: string    // "HH:MM" 形式（給与計算設定から）
): Promise<void> {
  // 純粋なUTC演算でJST時刻を扱う（toLocaleStringは環境依存のため使用しない）
  const JST_OFFSET_MS = 9 * 60 * 60 * 1000;
  let now = new Date();

  // デバッグ用モック時刻（"HH:MM"を今日のJST日付に適用）
  if (mockTime) {
    const [h, m] = mockTime.split(":").map(Number);
    const jstMs = now.getTime() + JST_OFFSET_MS;
    const msIntoJstDay = jstMs % 86400000;
    const jstMidnightUTC = now.getTime() - msIntoJstDay;
    now = new Date(jstMidnightUTC + h * 3600000 + m * 60000);
  }

  // JST時刻コンポーネントをUTCメソッドで取得（環境非依存）
  const jstDateObj = new Date(now.getTime() + JST_OFFSET_MS);
  const jstH = jstDateObj.getUTCHours();
  const jstM = jstDateObj.getUTCMinutes();

  // タイトル用フォーマット
  const pad = (n: number) => String(n).padStart(2, "0");
  const titleText = `${jstDateObj.getUTCFullYear()}-${pad(jstDateObj.getUTCMonth() + 1)}-${pad(jstDateObj.getUTCDate())} ${pad(jstH)}:${pad(jstM)} ${employeeName} ${type}`;

  // 給与計算打刻のロジック
  // 出勤: 始業標準時刻より前の打刻 → 始業標準時刻、以降は実打刻
  // 退勤: 常に実打刻
  const [STANDARD_START_HOUR, STANDARD_START_MIN] = (standardStartTime ?? "09:00")
    .split(":").map(Number);

  const jstMs = now.getTime() + JST_OFFSET_MS;
  const msIntoDay = jstMs % 86400000;
  const jstMidnightUTC = now.getTime() - msIntoDay;

  let payrollUTC = now;
  if (type === "出勤") {
    // 始業標準時刻より前 → 始業標準時刻に丸める
    if (jstH < STANDARD_START_HOUR || (jstH === STANDARD_START_HOUR && jstM < STANDARD_START_MIN)) {
      payrollUTC = new Date(jstMidnightUTC + STANDARD_START_HOUR * 3600000 + STANDARD_START_MIN * 60000);
    }
  } else {
    // 退勤: 終業標準時刻より後 → 終業標準時刻にキャップ
    const [STANDARD_END_HOUR, STANDARD_END_MIN] = (standardEndTime ?? "18:00").split(":").map(Number);
    if (jstH > STANDARD_END_HOUR || (jstH === STANDARD_END_HOUR && jstM >= STANDARD_END_MIN)) {
      payrollUTC = new Date(jstMidnightUTC + STANDARD_END_HOUR * 3600000 + STANDARD_END_MIN * 60000);
    }
  }

  const baseProperties: Record<string, any> = {
    タイトル: {
      title: [{ text: { content: titleText } }],
    },
    実打刻: {
      date: { start: now.toISOString() },
    },
    給与計算打刻: {
      date: { start: payrollUTC.toISOString() },
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
    if (msg.includes("給与計算打刻") || msg.includes("payroll") || msg.includes("property")) {
      console.warn("給与計算打刻プロパティが見つからないためスキップして再試行します");
      const { 給与計算打刻: _omit, ...propertiesWithout } = baseProperties;
      await notion.pages.create({
        parent: { database_id: process.env.DATABASE_ID! },
        properties: propertiesWithout,
      });
    } else {
      throw err;
    }
  }
}
