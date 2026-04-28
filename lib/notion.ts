import { Client } from "@notionhq/client";

const notion = new Client({ auth: process.env.NOTION_API_KEY });

/**
 * Notion DB プロパティ名の一元管理
 * Notion 側で名前を変更したら、ここだけ書き換えれば全体に反映される
 */
const F = {
  // ── 従業員マスタDB ────────────────
  IDENTIFIER: "従業員識別子",
  EMPLOYEE_NUMBER: "従業員番号",
  LAST_NAME: "姓",
  FIRST_NAME: "名",
  STORE_NAME: "事業所名",
  DEPARTMENT: "部門名",
  JOB_TITLE: "職種名",
  CONTRACT_TYPE: "契約職種",
  STATUS: "ステータス",
  RANK: "ランク",
  NOMINATION_FEE: "指名料",
  CAREER_TARGET: "キャリアアップ対象",
  JOIN_TYPE: "中途or新卒",
  JOIN_DATE: "入社時期",
  CAREER_UPDATE_DATE: "キャリアアップ更新時期",
  CAREER_INTERVIEW_DATE: "キャリアアップ面談時期",
  PROBATION_SALARY: "試用期間給与",
  REGULAR_SALARY: "正社員給与",
  // ── 勤怠ログDB ────────────────────
  TITLE: "タイトル",
  EMPLOYEE_REL: "②従業員マスタDB_RM03P",
  DATE: "日付",
  CLOCK_IN: "実打刻出勤",
  CLOCK_OUT: "実打刻退勤",
  PAYROLL_CLOCK_IN: "給与計算用出勤",
  PAYROLL_CLOCK_OUT: "給与計算用退勤",
  BREAK: "休憩",
  ACTUAL_HOURS: "実働",
  WORK_STATUS: "勤務状態",
  NOTE: "備考",
  APPROVED: "承認",
  // ── 店舗設定DB ────────────────────
  STORE_TITLE: "店舗名",
  CLOSING_DAY: "定休曜日",
  WORK_START: "始業標準時刻",
  WORK_END: "終業標準時刻",
  BREAK_HOURS: "休憩時間",
  OVERTIME_HOURS: "みなし残業時間",
  ALERT_THRESHOLD: "アラート閾値",
  // ── 保健師の一言DB ────────────────
  TIP_TEXT: "一言",
  TIP_ENABLED: "有効",
  // ── 時間外申請DB ───────────────────
  OVERTIME_EMPLOYEE_REL: "従業員",
  APPLY_DATE: "申請日",
  EARLY_REQUEST: "早出申請",
  EARLY_TIME: "早出時刻",
  EARLY_REASON: "早出理由",
  OVERTIME_REQUEST: "残業申請",
  OVERTIME_TIME: "残業時刻",
  OVERTIME_REASON: "残業理由",
} as const;

export type Employee = {
  id: string;
  name: string;
  store: string;
};

export type StampType = "出勤" | "退勤";

export type EmployeeDBOptions = {
  ranks: string[];
  nominationFees: string[];
  careerTargets: string[];
  joinTypes: string[];
  jobTitles: string[];
  contractTypes: string[];
  statuses: string[];
};

/** 従業員マスタDBの全 select option を取得 */
export async function getEmployeeDBOptions(): Promise<EmployeeDBOptions> {
  const db = await notion.databases.retrieve({ database_id: process.env.EMPLOYEE_DB_ID! }) as any;
  const read = (name: string): string[] => {
    const prop = db.properties?.[name];
    if (!prop) return [];
    if (prop.type === "select") return prop.select.options.map((o: any) => o.name);
    if (prop.type === "status") return prop.status.options.map((o: any) => o.name);
    return [];
  };
  return {
    ranks:         read(F.RANK),
    nominationFees: read(F.NOMINATION_FEE),
    careerTargets:  read(F.CAREER_TARGET),
    joinTypes:      read(F.JOIN_TYPE),
    jobTitles:      read(F.JOB_TITLE),
    contractTypes:  read(F.CONTRACT_TYPE),
    statuses:       read(F.STATUS),
  };
}

/** 店舗設定DBから {id: 店舗名} と {店舗名: id} の両方向マップを生成 */
async function fetchStoreMap(): Promise<{ idToName: Record<string, string>; nameToId: Record<string, string> }> {
  const res = await notion.databases.query({ database_id: process.env.STORE_SETTINGS_DB_ID! });
  const idToName: Record<string, string> = {};
  const nameToId: Record<string, string> = {};
  res.results.forEach((page: any) => {
    const name = page.properties[F.STORE_TITLE]?.title?.[0]?.plain_text ?? "";
    if (name) {
      idToName[page.id] = name;
      nameToId[name] = page.id;
    }
  });
  return { idToName, nameToId };
}

function readDepartmentFromRelation(prop: any, idToName: Record<string, string>): string {
  const first = prop?.relation?.[0]?.id;
  return first ? (idToName[first] ?? "") : "";
}

/** 従業員マスタを昇順で全件取得 */
export async function getAllEmployees(): Promise<Employee[]> {
  const [{ idToName }, response] = await Promise.all([
    fetchStoreMap(),
    notion.databases.query({
      database_id: process.env.EMPLOYEE_DB_ID!,
      sorts: [{ property: F.EMPLOYEE_NUMBER, direction: "ascending" }],
    }),
  ]);

  return response.results
    .map((page: any) => {
      let identifier = "";
      let lastName = "";
      let firstName = "";
      let status = "不明";
      let store = "";
      try { identifier = (page.properties[F.IDENTIFIER]?.title ?? []).map((t: any) => t.plain_text ?? t.text?.content ?? "").join("").replace(/[\n\r]/g, "").trim(); } catch {}
      try { lastName = page.properties[F.LAST_NAME]?.rich_text?.[0]?.text?.content ?? ""; } catch {}
      try { firstName = page.properties[F.FIRST_NAME]?.rich_text?.[0]?.text?.content ?? ""; } catch {}
      try {
        status = page.properties[F.STATUS]?.status?.name
          ?? page.properties[F.STATUS]?.select?.name
          ?? "不明";
      } catch {}
      try { store = readDepartmentFromRelation(page.properties[F.DEPARTMENT], idToName); } catch {}
      const name = [lastName, firstName].filter(Boolean).join(" ") || identifier || "不明";
      return { id: page.id, name, status, store };
    })
    .filter((emp) => emp.status !== "退職");
}

/**
 * 給与計算用の打刻丸め処理
 * - 出勤：標準始業より早ければ標準始業に、それ以外は実打刻のまま
 * - 退勤：標準終業より遅ければ標準終業に、それ以外は実打刻のまま
 *
 * 標準時刻は "HH:MM" の文字列。実打刻と同じ日付（JST）の標準時刻として合成する。
 * 標準時刻文字列が空・不正なら丸めなし（=実打刻をそのまま返す）。
 */
function buildStandardJstDate(actual: Date, hhmm: string): Date | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (Number.isNaN(h) || Number.isNaN(min)) return null;
  // JSTでの「実打刻と同じ日付」の HH:MM を作る
  const JST_OFFSET_MS = 9 * 60 * 60 * 1000;
  const jstActual = new Date(actual.getTime() + JST_OFFSET_MS);
  const y = jstActual.getUTCFullYear();
  const mo = jstActual.getUTCMonth();
  const d = jstActual.getUTCDate();
  // UTC上で y/mo/d の H:min を作り、JST分を引いてUTCに戻す
  const standardUtcMs = Date.UTC(y, mo, d, h, min, 0, 0) - JST_OFFSET_MS;
  return new Date(standardUtcMs);
}

export function roundClockIn(actual: Date, standardStartHHMM: string): Date {
  const std = buildStandardJstDate(actual, standardStartHHMM);
  if (!std) return actual;
  return actual < std ? std : actual;
}

export function roundClockOut(actual: Date, standardEndHHMM: string): Date {
  const std = buildStandardJstDate(actual, standardEndHHMM);
  if (!std) return actual;
  return actual > std ? std : actual;
}

/** 従業員マスタを全件取得（管理者画面用・退職者含む） */
export async function getAllEmployeesAdmin(): Promise<EmployeeAdmin[]> {
  const [{ idToName }, response] = await Promise.all([
    fetchStoreMap(),
    notion.databases.query({
      database_id: process.env.EMPLOYEE_DB_ID!,
      sorts: [{ property: F.EMPLOYEE_NUMBER, direction: "ascending" }],
    }),
  ]);

  return response.results.flatMap((page: any) => {
    try {
      const identifier    = (page.properties[F.IDENTIFIER]?.title ?? []).map((t: any) => t.plain_text ?? t.text?.content ?? "").join("").replace(/[\n\r]/g, "").trim();
      const employeeNumber = page.properties[F.EMPLOYEE_NUMBER]?.rich_text?.[0]?.text?.content ?? "";
      const lastName      = page.properties[F.LAST_NAME]?.rich_text?.[0]?.text?.content ?? "";
      const firstName     = page.properties[F.FIRST_NAME]?.rich_text?.[0]?.text?.content ?? "";
      const storeName     = page.properties[F.STORE_NAME]?.select?.name ?? "";
      const department    = readDepartmentFromRelation(page.properties[F.DEPARTMENT], idToName);
      const jobTitle      = page.properties[F.JOB_TITLE]?.select?.name ?? "";
      const contractType  = page.properties[F.CONTRACT_TYPE]?.select?.name ?? "";
      const status        = page.properties[F.STATUS]?.status?.name
        ?? page.properties[F.STATUS]?.select?.name
        ?? "不明";
      const rank              = page.properties[F.RANK]?.select?.name ?? "";
      const nominationFee     = page.properties[F.NOMINATION_FEE]?.select?.name ?? "";
      const careerTarget      = page.properties[F.CAREER_TARGET]?.select?.name ?? "";
      const joinType          = page.properties[F.JOIN_TYPE]?.select?.name ?? "";
      const joinDate          = page.properties[F.JOIN_DATE]?.date?.start ?? "";
      const careerUpdateDate  = page.properties[F.CAREER_UPDATE_DATE]?.date?.start ?? "";
      const careerInterviewDate = page.properties[F.CAREER_INTERVIEW_DATE]?.date?.start ?? "";
      const probationSalary     = page.properties[F.PROBATION_SALARY]?.number ?? null;
      const regularSalary       = page.properties[F.REGULAR_SALARY]?.number ?? null;
      const name  = [lastName, firstName].filter(Boolean).join(" ") || identifier;
      const store = department;
      return [{ id: page.id, identifier, employeeNumber, lastName, firstName, storeName, department, jobTitle, contractType, status, name, store, rank, nominationFee, careerTarget, joinType, joinDate, careerUpdateDate, careerInterviewDate, probationSalary, regularSalary }];
    } catch {
      return [];
    }
  });
}

/** 従業員を更新 */
export async function updateEmployee(
  id: string,
  fields: Partial<{
    identifier: string;
    employeeNumber: string;
    lastName: string;
    firstName: string;
    storeName: string;
    department: string;
    jobTitle: string;
    contractType: string;
    status: string;
    rank: string;
    nominationFee: string;
    careerTarget: string;
    joinType: string;
    joinDate: string;
    careerUpdateDate: string;
    careerInterviewDate: string;
    probationSalary: number | null;
    regularSalary: number | null;
  }>
): Promise<void> {
  const props: Record<string, any> = {};
  if (fields.identifier         !== undefined) props[F.IDENTIFIER]            = { title:     [{ text: { content: fields.identifier } }] };
  if (fields.employeeNumber     !== undefined) props[F.EMPLOYEE_NUMBER]       = { rich_text: [{ text: { content: fields.employeeNumber } }] };
  if (fields.lastName           !== undefined) props[F.LAST_NAME]             = { rich_text: [{ text: { content: fields.lastName } }] };
  if (fields.firstName          !== undefined) props[F.FIRST_NAME]            = { rich_text: [{ text: { content: fields.firstName } }] };
  if (fields.storeName          !== undefined) props[F.STORE_NAME]            = { select: { name: fields.storeName } };
  if (fields.department         !== undefined) {
    const { nameToId } = await fetchStoreMap();
    const relId = nameToId[fields.department];
    props[F.DEPARTMENT] = { relation: relId ? [{ id: relId }] : [] };
  }
  if (fields.jobTitle           !== undefined) props[F.JOB_TITLE]             = { select: { name: fields.jobTitle } };
  if (fields.contractType       !== undefined) props[F.CONTRACT_TYPE]         = { select: { name: fields.contractType } };
  if (fields.status             !== undefined) props[F.STATUS]                = { select: { name: fields.status } };
  if (fields.rank               !== undefined) props[F.RANK]                  = { select: { name: fields.rank } };
  if (fields.nominationFee      !== undefined) props[F.NOMINATION_FEE]        = { select: { name: fields.nominationFee } };
  if (fields.careerTarget       !== undefined) props[F.CAREER_TARGET]         = { select: { name: fields.careerTarget } };
  if (fields.joinType           !== undefined) props[F.JOIN_TYPE]             = { select: { name: fields.joinType } };
  if (fields.joinDate           !== undefined) props[F.JOIN_DATE]             = fields.joinDate ? { date: { start: fields.joinDate } } : { date: null };
  if (fields.careerUpdateDate   !== undefined) props[F.CAREER_UPDATE_DATE]    = fields.careerUpdateDate ? { date: { start: fields.careerUpdateDate } } : { date: null };
  if (fields.careerInterviewDate !== undefined) props[F.CAREER_INTERVIEW_DATE] = fields.careerInterviewDate ? { date: { start: fields.careerInterviewDate } } : { date: null };
  if (fields.probationSalary     !== undefined) props[F.PROBATION_SALARY]     = { number: fields.probationSalary };
  if (fields.regularSalary       !== undefined) props[F.REGULAR_SALARY]       = { number: fields.regularSalary };
  if (Object.keys(props).length > 0) {
    await notion.pages.update({ page_id: id, properties: props });
  }
}

/** 従業員を新規追加 */
export async function createEmployee(fields: {
  identifier: string;
  employeeNumber: string;
  lastName: string;
  firstName: string;
  storeName: string;
  department: string;
  jobTitle: string;
  contractType: string;
  status: string;
}): Promise<EmployeeAdmin> {
  const properties: Record<string, any> = {
    [F.IDENTIFIER]:      { title:     [{ text: { content: fields.identifier } }] },
    [F.EMPLOYEE_NUMBER]: { rich_text: [{ text: { content: fields.employeeNumber } }] },
    [F.LAST_NAME]:       { rich_text: [{ text: { content: fields.lastName } }] },
    [F.FIRST_NAME]:      { rich_text: [{ text: { content: fields.firstName } }] },
    [F.STATUS]:          { select:    { name: fields.status } },
  };
  if (fields.storeName)    properties[F.STORE_NAME] = { select: { name: fields.storeName } };
  if (fields.department) {
    const { nameToId } = await fetchStoreMap();
    const relId = nameToId[fields.department];
    properties[F.DEPARTMENT] = { relation: relId ? [{ id: relId }] : [] };
  }
  if (fields.jobTitle)     properties[F.JOB_TITLE]     = { select: { name: fields.jobTitle } };
  if (fields.contractType) properties[F.CONTRACT_TYPE] = { select: { name: fields.contractType } };
  const page = await notion.pages.create({
    parent: { database_id: process.env.EMPLOYEE_DB_ID! },
    properties,
  }) as any;
  const name  = [fields.lastName, fields.firstName].filter(Boolean).join(" ") || fields.identifier;
  const store = fields.department;
  return { id: page.id, ...fields, name, store, rank: "", nominationFee: "", careerTarget: "", joinType: "", joinDate: "", careerUpdateDate: "", careerInterviewDate: "", probationSalary: null, regularSalary: null };
}

/** 保健師の一言を全件取得（有効=trueのみ・打刻画面用） */
export async function getAllTips(): Promise<string[]> {
  const response = await notion.databases.query({
    database_id: process.env.TIPS_DB_ID!,
    filter: { property: F.TIP_ENABLED, checkbox: { equals: true } },
  });

  return response.results.flatMap((page: any) => {
    try {
      const text = page.properties[F.TIP_TEXT].title[0].text.content.replace(/\\n/g, "\n");
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
  identifier: string;
  employeeNumber: string;
  lastName: string;
  firstName: string;
  storeName: string;
  department: string;
  jobTitle: string;
  contractType: string;
  status: string;
  name: string;             // 姓+名（後方互換）
  store: string;            // =department（後方互換）
  // キャリア情報
  rank: string;             // ランク
  nominationFee: string;    // 指名料（select）
  careerTarget: string;     // キャリアアップ対象
  joinType: string;         // 中途or新卒
  joinDate: string;         // 入社時期
  careerUpdateDate: string; // キャリアアップ更新時期
  careerInterviewDate: string; // キャリアアップ面談時期
  probationSalary: number | null;   // 試用期間給与
  regularSalary: number | null;     // 正社員給与
};

/** 保健師の一言を全件取得（有効・無効含む・管理者画面用） */
export async function getAllTipsAdmin(): Promise<Tip[]> {
  const response = await notion.databases.query({
    database_id: process.env.TIPS_DB_ID!,
    sorts: [{ property: F.TIP_ENABLED, direction: "descending" }],
  });

  return response.results.flatMap((page: any) => {
    try {
      const text = (page.properties[F.TIP_TEXT].title[0]?.text.content ?? "").replace(/\\n/g, "\n");
      const enabled = page.properties[F.TIP_ENABLED].checkbox ?? false;
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
      [F.TIP_TEXT]:    { title: [{ text: { content: text } }] },
      [F.TIP_ENABLED]: { checkbox: enabled },
    },
  }) as any;
  return { id: page.id, text, enabled };
}

/** 保健師の一言を更新 */
export async function updateTip(id: string, text: string, enabled: boolean): Promise<void> {
  await notion.pages.update({
    page_id: id,
    properties: {
      [F.TIP_TEXT]:    { title: [{ text: { content: text } }] },
      [F.TIP_ENABLED]: { checkbox: enabled },
    },
  });
}

export type PayrollSettings = {
  id: string;
  startTime: string;        // "HH:MM"
  endTime: string;          // "HH:MM"
  breakHours: number;       // 退勤打刻時に書き込む休憩時間（h）
  deemedOvertimeHours: number;
  alertThreshold: number;
};

const PAYROLL_SETTINGS_DEFAULTS: Omit<PayrollSettings, "id"> = {
  startTime: "09:00",
  endTime: "18:00",
  breakHours: 2.5,
  deemedOvertimeHours: 30,
  alertThreshold: 80,
};

/** 給与計算設定を特定店舗ページから取得 */
export async function getPayrollSettings(pageId: string): Promise<PayrollSettings> {
  const page = await notion.pages.retrieve({ page_id: pageId }) as any;
  try {
    return {
      id: page.id,
      startTime:            page.properties[F.WORK_START]?.rich_text?.[0]?.text?.content ?? PAYROLL_SETTINGS_DEFAULTS.startTime,
      endTime:              page.properties[F.WORK_END]?.rich_text?.[0]?.text?.content ?? PAYROLL_SETTINGS_DEFAULTS.endTime,
      breakHours:           page.properties[F.BREAK_HOURS]?.number     ?? PAYROLL_SETTINGS_DEFAULTS.breakHours,
      deemedOvertimeHours:  page.properties[F.OVERTIME_HOURS]?.number ?? PAYROLL_SETTINGS_DEFAULTS.deemedOvertimeHours,
      alertThreshold:       page.properties[F.ALERT_THRESHOLD]?.number   ?? PAYROLL_SETTINGS_DEFAULTS.alertThreshold,
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
      [F.WORK_START]:      { rich_text: [{ text: { content: settings.startTime } }] },
      [F.WORK_END]:        { rich_text: [{ text: { content: settings.endTime } }] },
      [F.BREAK_HOURS]:     { number: settings.breakHours },
      [F.OVERTIME_HOURS]:  { number: settings.deemedOvertimeHours },
      [F.ALERT_THRESHOLD]: { number: settings.alertThreshold },
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
  const pad = (n: number) => String(n).padStart(2, "0");
  const todayStr = `${jstNow.getUTCFullYear()}-${pad(jstNow.getUTCMonth() + 1)}-${pad(jstNow.getUTCDate())}`;

  const response = await notion.databases.query({
    database_id: process.env.TIMELOG_DB_ID!,
    filter: {
      and: [
        { property: F.EMPLOYEE_REL, relation: { contains: employeeId } },
        { property: F.DATE, date: { equals: todayStr } },
      ],
    },
  });

  const results: PunchRecord[] = [];
  for (const page of response.results as any[]) {
    const clockInISO  = page.properties[F.CLOCK_IN]?.date?.start;
    const clockOutISO = page.properties[F.CLOCK_OUT]?.date?.start;
    if (clockInISO) {
      const t = new Date(new Date(clockInISO).getTime() + JST_OFFSET_MS);
      results.push({ type: "出勤", timeStr: `${pad(t.getUTCHours())}:${pad(t.getUTCMinutes())}` });
    }
    if (clockOutISO) {
      const t = new Date(new Date(clockOutISO).getTime() + JST_OFFSET_MS);
      results.push({ type: "退勤", timeStr: `${pad(t.getUTCHours())}:${pad(t.getUTCMinutes())}` });
    }
  }
  return results;
}

export type OvertimeRequest = {
  id: string;
  employeeId: string;       // 従業員リレーションのID
  employeeName: string;     // 表示用に従業員マスタから取得した姓+名
  applyDate: string;        // "YYYY-MM-DD"
  earlyArrival: boolean;
  earlyTime: string;
  earlyReason: string;
  overtime: boolean;
  overtimeTime: string;
  overtimeReason: string;
  status: string;           // "未対応" | "承認済み" | "却下"
};

/**
 * 指定の条件で時間外申請を取得（管理画面用）
 * status: 未指定なら全件、指定すればそのステータスのみ
 * 従業員マスタを引いて表示用の名前も付与する
 */
export async function getOvertimeRequests(filter?: {
  status?: string;
}): Promise<OvertimeRequest[]> {
  const queryFilter = filter?.status
    ? { property: F.STATUS, status: { equals: filter.status } }
    : undefined;

  const response = await notion.databases.query({
    database_id: process.env.OVERTIME_REQUEST_DB_ID!,
    ...(queryFilter ? { filter: queryFilter } : {}),
    sorts: [{ property: F.APPLY_DATE, direction: "descending" }],
  });

  // 従業員IDを集めて従業員マスタから名前マップを構築
  const empIds = new Set<string>();
  for (const p of response.results as any[]) {
    const id = p.properties[F.OVERTIME_EMPLOYEE_REL]?.relation?.[0]?.id;
    if (id) empIds.add(id);
  }
  const idToName = new Map<string, string>();
  if (empIds.size > 0) {
    const empResponse = await notion.databases.query({
      database_id: process.env.EMPLOYEE_DB_ID!,
    });
    for (const p of empResponse.results as any[]) {
      if (!empIds.has(p.id)) continue;
      const last  = p.properties[F.LAST_NAME]?.rich_text?.[0]?.text?.content ?? "";
      const first = p.properties[F.FIRST_NAME]?.rich_text?.[0]?.text?.content ?? "";
      idToName.set(p.id, [last, first].filter(Boolean).join(" "));
    }
  }

  return (response.results as any[]).flatMap((page) => {
    try {
      const employeeId = page.properties[F.OVERTIME_EMPLOYEE_REL]?.relation?.[0]?.id ?? "";
      return [{
        id: page.id,
        employeeId,
        employeeName:    idToName.get(employeeId) ?? "",
        applyDate:       page.properties[F.APPLY_DATE]?.date?.start ?? "",
        earlyArrival:    page.properties[F.EARLY_REQUEST]?.checkbox ?? false,
        earlyTime:       page.properties[F.EARLY_TIME]?.rich_text?.[0]?.text?.content ?? "",
        earlyReason:     page.properties[F.EARLY_REASON]?.rich_text?.[0]?.text?.content ?? "",
        overtime:        page.properties[F.OVERTIME_REQUEST]?.checkbox ?? false,
        overtimeTime:    page.properties[F.OVERTIME_TIME]?.rich_text?.[0]?.text?.content ?? "",
        overtimeReason:  page.properties[F.OVERTIME_REASON]?.rich_text?.[0]?.text?.content ?? "",
        status:          page.properties[F.STATUS]?.status?.name ?? "未対応",
      }];
    } catch {
      return [];
    }
  });
}

/**
 * 時間外申請を承認
 * - 該当日の勤怠ログを検索し、早出申請なら給与計算用出勤を実打刻で上書き、残業申請なら給与計算用退勤を実打刻で上書き
 * - 申請のステータスを「承認済み」に更新
 */
export async function approveOvertimeRequest(requestId: string): Promise<void> {
  // 1. 申請レコード取得
  const reqPage = await notion.pages.retrieve({ page_id: requestId }) as any;
  const employeeId   = reqPage.properties[F.OVERTIME_EMPLOYEE_REL]?.relation?.[0]?.id;
  const applyDate    = reqPage.properties[F.APPLY_DATE]?.date?.start ?? "";
  const earlyArrival = reqPage.properties[F.EARLY_REQUEST]?.checkbox ?? false;
  const overtime     = reqPage.properties[F.OVERTIME_REQUEST]?.checkbox ?? false;

  if (!applyDate) throw new Error("申請データが不正です（申請日なし）");
  if (!employeeId) throw new Error("申請データが不正です（従業員リレーションなし）");

  // 2. 該当日の勤怠ログレコードを検索
  const logs = await notion.databases.query({
    database_id: process.env.TIMELOG_DB_ID!,
    filter: {
      and: [
        { property: F.EMPLOYEE_REL, relation: { contains: employeeId } },
        { property: F.DATE, date: { equals: applyDate } },
      ],
    },
  });
  const logPage = (logs.results as any[])[0];
  if (!logPage) throw new Error(`${applyDate} の勤怠ログが見つかりません`);

  // 3. 給与計算用打刻を実打刻で上書き
  const props: Record<string, any> = {};
  if (earlyArrival) {
    const actualClockIn = logPage.properties[F.CLOCK_IN]?.date?.start;
    if (actualClockIn) props[F.PAYROLL_CLOCK_IN] = { date: { start: actualClockIn } };
  }
  if (overtime) {
    const actualClockOut = logPage.properties[F.CLOCK_OUT]?.date?.start;
    if (actualClockOut) props[F.PAYROLL_CLOCK_OUT] = { date: { start: actualClockOut } };
  }
  if (Object.keys(props).length > 0) {
    await notion.pages.update({ page_id: logPage.id, properties: props });
  }

  // 4. 申請ステータスを更新
  await notion.pages.update({
    page_id: requestId,
    properties: { [F.STATUS]: { status: { name: "承認済み" } } },
  });
}

/** 時間外申請を却下（ステータス更新のみ） */
export async function rejectOvertimeRequest(requestId: string): Promise<void> {
  await notion.pages.update({
    page_id: requestId,
    properties: { [F.STATUS]: { status: { name: "却下" } } },
  });
}

/** 時間外申請をNotionに書き込む */
export async function createOvertimeRequest(data: {
  employeePageId: string;
  employeeName: string;     // タイトル生成用（DB列としては保存しない）
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
      [F.TITLE]:                 { title: [{ text: { content: title } }] },
      [F.OVERTIME_EMPLOYEE_REL]: { relation: [{ id: data.employeePageId }] },
      [F.APPLY_DATE]:            { date: { start: data.applyDate } },
      [F.EARLY_REQUEST]:         { checkbox: data.earlyArrival },
      [F.EARLY_TIME]:            { rich_text: [{ text: { content: data.earlyTime } }] },
      [F.EARLY_REASON]:          { rich_text: [{ text: { content: data.earlyReason } }] },
      [F.OVERTIME_REQUEST]:      { checkbox: data.overtime },
      [F.OVERTIME_TIME]:         { rich_text: [{ text: { content: data.overtimeTime } }] },
      [F.OVERTIME_REASON]:       { rich_text: [{ text: { content: data.overtimeReason } }] },
      [F.STATUS]:                { status: { name: "未対応" } },
    },
  });
}

export type MonthlyRecord = {
  id: string;          // Notion page ID
  date: string;        // "YYYY-MM-DD"
  clockIn: string;     // "HH:MM" or ""
  clockOut: string;    // "HH:MM" or ""
  break: string;       // "2.5" or ""
  actualHours: number | null;  // 実働（Notion formula）
  workStatus: string;  // 勤務状態
  note: string;        // 備考
  approved: boolean;   // 既存の承認フラグ（月単位承認用に温存）
  requestStatus: "" | "承認待ち" | "承認済";  // 時間外申請の状況
};

/** 指定月の勤怠レコードを全件取得（時間外申請ステータス join 済み） */
export async function getMonthlyRecords(
  employeePageId: string,
  year: number,
  month: number
): Promise<MonthlyRecord[]> {
  const pad = (n: number) => String(n).padStart(2, "0");
  const startDate = `${year}-${pad(month)}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const endDate = `${year}-${pad(month)}-${pad(lastDay)}`;
  const JST_OFFSET_MS = 9 * 60 * 60 * 1000;

  // 同月の時間外申請を従業員リレーションで絞り込み取得 → 日付別にステータスをマップ化
  const requestStatusByDate = new Map<string, "承認待ち" | "承認済">();
  try {
    const reqResponse = await notion.databases.query({
      database_id: process.env.OVERTIME_REQUEST_DB_ID!,
      filter: {
        and: [
          { property: F.OVERTIME_EMPLOYEE_REL, relation: { contains: employeePageId } },
          { property: F.APPLY_DATE, date: { on_or_after: startDate } },
          { property: F.APPLY_DATE, date: { on_or_before: endDate } },
        ],
      },
    });
    for (const p of reqResponse.results as any[]) {
      const date = p.properties[F.APPLY_DATE]?.date?.start ?? "";
      const status = p.properties[F.STATUS]?.status?.name ?? "";
      if (!date || status === "却下") continue;
      if (status === "承認済み") requestStatusByDate.set(date, "承認済");
      else if (status === "未対応") {
        if (!requestStatusByDate.has(date)) requestStatusByDate.set(date, "承認待ち");
      }
    }
  } catch {}

  const response = await notion.databases.query({
    database_id: process.env.TIMELOG_DB_ID!,
    filter: {
      and: [
        { property: F.EMPLOYEE_REL, relation: { contains: employeePageId } },
        { property: F.DATE, date: { on_or_after: startDate } },
        { property: F.DATE, date: { on_or_before: endDate } },
      ],
    },
    sorts: [{ property: F.DATE, direction: "ascending" }],
  });

  return (response.results as any[]).map((page) => {
    const toJstTime = (iso: string | undefined): string => {
      if (!iso) return "";
      const t = new Date(new Date(iso).getTime() + JST_OFFSET_MS);
      return `${pad(t.getUTCHours())}:${pad(t.getUTCMinutes())}`;
    };

    const date = page.properties[F.DATE]?.date?.start ?? "";
    const clockIn = toJstTime(page.properties[F.PAYROLL_CLOCK_IN]?.date?.start);
    const clockOut = toJstTime(page.properties[F.PAYROLL_CLOCK_OUT]?.date?.start);
    const breakRaw = page.properties[F.BREAK];
    const breakVal = breakRaw?.select?.name
      ?? (breakRaw?.number != null ? String(breakRaw.number) : null)
      ?? breakRaw?.rich_text?.[0]?.text?.content
      ?? "";
    const actualHours = page.properties[F.ACTUAL_HOURS]?.formula?.number ?? null;
    const workStatus = page.properties[F.WORK_STATUS]?.select?.name ?? "";
    const note = page.properties[F.NOTE]?.rich_text?.[0]?.text?.content ?? "";
    const approved = page.properties[F.APPROVED]?.select?.name === "承認済み"
      || page.properties[F.APPROVED]?.checkbox === true;

    const requestStatus = requestStatusByDate.get(date) ?? "";
    return { id: page.id, date, clockIn, clockOut, break: breakVal, actualHours, workStatus, note, approved, requestStatus };
  });
}

export type StoreSettings = {
  id: string;
  storeName: string;
  closingDay: number; // 0=日 1=月 2=火 3=水 4=木 5=金 6=土
};

const DOW_MAP: Record<string, number> = { 日: 0, 月: 1, 火: 2, 水: 3, 木: 4, 金: 5, 土: 6 };

/** 店舗設定を全件取得 */
export async function getStoreSettings(): Promise<StoreSettings[]> {
  const response = await notion.databases.query({
    database_id: process.env.STORE_SETTINGS_DB_ID!,
  });

  return (response.results as any[]).flatMap((page) => {
    try {
      const storeName = page.properties[F.STORE_TITLE].title[0]?.text?.content ?? "";
      const closingDayStr = page.properties[F.CLOSING_DAY]?.select?.name ?? "";
      const closingDay = DOW_MAP[closingDayStr] ?? 2;
      return [{ id: page.id, storeName, closingDay }];
    } catch {
      return [];
    }
  });
}

const DOW_NAMES = ["日", "月", "火", "水", "木", "金", "土"];

/** 店舗設定の定休曜日を更新 */
export async function updateStoreClosingDay(pageId: string, closingDay: number): Promise<void> {
  await notion.pages.update({
    page_id: pageId,
    properties: {
      [F.CLOSING_DAY]: { select: { name: DOW_NAMES[closingDay] } },
    },
  });
}

/** 月次レコードを更新 */
export async function updateMonthlyRecord(
  pageId: string,
  date: string, // "YYYY-MM-DD" — 時刻のISO変換に使用
  updates: {
    newDate?: string;    // 日付移動（YYYY-MM-DD）
    clockIn?: string;    // "HH:MM" JST、"" でクリア
    clockOut?: string;
    break?: string;
    workStatus?: string;
    note?: string;
  }
): Promise<void> {
  const props: Record<string, any> = {};

  if (updates.newDate !== undefined) {
    props[F.DATE] = { date: { start: updates.newDate } };
  }

  if (updates.clockIn !== undefined) {
    props[F.PAYROLL_CLOCK_IN] = updates.clockIn
      ? { date: { start: new Date(`${date}T${updates.clockIn}:00+09:00`).toISOString() } }
      : { date: null };
  }
  if (updates.clockOut !== undefined) {
    props[F.PAYROLL_CLOCK_OUT] = updates.clockOut
      ? { date: { start: new Date(`${date}T${updates.clockOut}:00+09:00`).toISOString() } }
      : { date: null };
  }
  if (updates.break !== undefined) {
    props[F.BREAK] = updates.break ? { select: { name: updates.break } } : { select: null };
  }
  if (updates.workStatus !== undefined) {
    props[F.WORK_STATUS] = updates.workStatus ? { select: { name: updates.workStatus } } : { select: null };
  }
  if (updates.note !== undefined) {
    props[F.NOTE] = { rich_text: updates.note ? [{ text: { content: updates.note } }] : [] };
  }

  if (Object.keys(props).length > 0) {
    await notion.pages.update({ page_id: pageId, properties: props });
  }
}

/** 公休・有給レコードを作成 → 作成したページIDを返す */
export async function createHolidayRecord(
  employeePageId: string,
  employeeName: string,
  date: string, // "YYYY-MM-DD"
  workType: "公休" | "有給" = "公休"
): Promise<string> {
  const page = await notion.pages.create({
    parent: { database_id: process.env.TIMELOG_DB_ID! },
    properties: {
      [F.TITLE]:        { title: [{ text: { content: `${date} ${employeeName}` } }] },
      [F.EMPLOYEE_REL]: { relation: [{ id: employeePageId }] },
      [F.DATE]:         { date: { start: date } },
      [F.WORK_STATUS]:  { select: { name: workType } },
    },
  }) as any;
  return page.id as string;
}

/** 公休レコードを削除（アーカイブ） */
export async function deleteHolidayRecord(pageId: string): Promise<void> {
  await notion.pages.update({ page_id: pageId, archived: true });
}

export type HolidayEntry = {
  pageId: string;
  date: string;          // "YYYY-MM-DD"
  employeePageId: string;
  type: "公休" | "有給";
};

/** 指定月の公休・有給レコードを全件取得 */
export async function getMonthHolidayRecords(year: number, month: number): Promise<HolidayEntry[]> {
  const pad = (n: number) => String(n).padStart(2, "0");
  const startDate = `${year}-${pad(month)}-01`;
  const endDate = `${year}-${pad(month)}-${pad(new Date(year, month, 0).getDate())}`;

  const response = await notion.databases.query({
    database_id: process.env.TIMELOG_DB_ID!,
    filter: {
      and: [
        { property: F.DATE, date: { on_or_after: startDate } },
        { property: F.DATE, date: { on_or_before: endDate } },
        { or: [
          { property: F.WORK_STATUS, select: { equals: "公休" } },
          { property: F.WORK_STATUS, select: { equals: "有給" } },
        ]},
      ],
    },
  });

  return (response.results as any[]).flatMap((page) => {
    try {
      const date = page.properties[F.DATE]?.date?.start ?? "";
      const employeePageId = page.properties[F.EMPLOYEE_REL]?.relation?.[0]?.id ?? "";
      const type = page.properties[F.WORK_STATUS]?.select?.name as "公休" | "有給";
      if (!date || !employeePageId || (type !== "公休" && type !== "有給")) return [];
      return [{ pageId: page.id, date, employeePageId, type }];
    } catch {
      return [];
    }
  });
}

/** JST時刻を計算するユーティリティ */
function resolveNow(mockTime?: string): Date {
  const JST_OFFSET_MS = 9 * 60 * 60 * 1000;
  let now = new Date();
  if (mockTime) {
    const [h, m] = mockTime.split(":").map(Number);
    const jstMs = now.getTime() + JST_OFFSET_MS;
    const jstMidnightUTC = now.getTime() - (jstMs % 86400000);
    now = new Date(jstMidnightUTC + h * 3600000 + m * 60000);
  }
  return now;
}

/**
 * 従業員ページから所属店舗の給与計算設定（標準時刻・休憩時間）を取得
 * 取得できなければ null（=丸めなし・休憩はデフォルト2.5h扱い）
 */
async function getEmployeePayrollContext(
  employeePageId: string
): Promise<{ startTime: string; endTime: string; breakHours: number } | null> {
  try {
    const empPage = await notion.pages.retrieve({ page_id: employeePageId }) as any;
    const storeRelId = empPage.properties[F.DEPARTMENT]?.relation?.[0]?.id;
    if (!storeRelId) return null;
    const settings = await getPayrollSettings(storeRelId);
    if (!settings.startTime || !settings.endTime) return null;
    return { startTime: settings.startTime, endTime: settings.endTime, breakHours: settings.breakHours };
  } catch {
    return null;
  }
}

/** 出勤打刻：新規レコードを作成 */
export async function registerClockIn(
  pageId: string,
  employeeName: string,
  mockTime?: string
): Promise<void> {
  const JST_OFFSET_MS = 9 * 60 * 60 * 1000;
  const now = resolveNow(mockTime);
  const jst = new Date(now.getTime() + JST_OFFSET_MS);
  const pad = (n: number) => String(n).padStart(2, "0");
  const dateStr = `${jst.getUTCFullYear()}-${pad(jst.getUTCMonth() + 1)}-${pad(jst.getUTCDate())}`;

  // 同日に出勤済み・退勤未入力のレコードがあればエラー
  const existing = await notion.databases.query({
    database_id: process.env.TIMELOG_DB_ID!,
    filter: {
      and: [
        { property: F.EMPLOYEE_REL, relation: { contains: pageId } },
        { property: F.DATE, date: { equals: dateStr } },
      ],
    },
  });
  const alreadyIn = (existing.results as any[]).some(
    (p) => p.properties[F.CLOCK_IN]?.date?.start && !p.properties[F.CLOCK_OUT]?.date?.start
  );
  if (alreadyIn) throw new Error("ALREADY_CLOCKED_IN");

  // 標準時刻を取得して給与計算用打刻を計算
  const ctx = await getEmployeePayrollContext(pageId);
  const payrollClockIn = ctx ? roundClockIn(now, ctx.startTime) : now;

  await notion.pages.create({
    parent: { database_id: process.env.TIMELOG_DB_ID! },
    properties: {
      [F.TITLE]:             { title: [{ text: { content: `${dateStr} ${employeeName}` } }] },
      [F.EMPLOYEE_REL]:      { relation: [{ id: pageId }] },
      [F.DATE]:              { date: { start: dateStr } },
      [F.CLOCK_IN]:          { date: { start: now.toISOString() } },
      [F.PAYROLL_CLOCK_IN]:  { date: { start: payrollClockIn.toISOString() } },
      [F.WORK_STATUS]:       { select: { name: "出勤" } },
    },
  });
}

/** 退勤打刻：同日の出勤済みレコードを更新 */
export async function registerClockOut(
  pageId: string,
  mockTime?: string
): Promise<void> {
  const JST_OFFSET_MS = 9 * 60 * 60 * 1000;
  const now = resolveNow(mockTime);
  const jst = new Date(now.getTime() + JST_OFFSET_MS);
  const pad = (n: number) => String(n).padStart(2, "0");
  const dateStr = `${jst.getUTCFullYear()}-${pad(jst.getUTCMonth() + 1)}-${pad(jst.getUTCDate())}`;

  // 同日・同従業員のレコードを取得
  const response = await notion.databases.query({
    database_id: process.env.TIMELOG_DB_ID!,
    filter: {
      and: [
        { property: F.EMPLOYEE_REL, relation: { contains: pageId } },
        { property: F.DATE, date: { equals: dateStr } },
      ],
    },
  });

  // 出勤済み・退勤未入力のレコードを探す
  const target = (response.results as any[]).find(
    (p) => p.properties[F.CLOCK_IN]?.date?.start && !p.properties[F.CLOCK_OUT]?.date?.start
  );
  if (!target) throw new Error("ALREADY_CLOCKED_OUT");

  // 標準時刻と休憩時間を取得して給与計算用退勤・休憩を決定
  const ctx = await getEmployeePayrollContext(pageId);
  const payrollClockOut = ctx ? roundClockOut(now, ctx.endTime) : now;
  const breakHours = ctx ? ctx.breakHours : 2.5;

  await notion.pages.update({
    page_id: target.id,
    properties: {
      [F.CLOCK_OUT]:          { date: { start: now.toISOString() } },
      [F.PAYROLL_CLOCK_OUT]:  { date: { start: payrollClockOut.toISOString() } },
      [F.BREAK]:              { number: breakHours },
    },
  });
}
