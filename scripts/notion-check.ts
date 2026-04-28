/**
 * notion-check: NotionDBのスキーマとコードの期待値を照合するスクリプト
 * 使い方: npm run notion-check
 */

import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { Client } from "@notionhq/client";

const notion = new Client({ auth: process.env.NOTION_API_KEY });

// ── カラー出力 ────────────────────────────────
const g = (s: string) => `\x1b[32m${s}\x1b[0m`; // green
const r = (s: string) => `\x1b[31m${s}\x1b[0m`; // red
const y = (s: string) => `\x1b[33m${s}\x1b[0m`; // yellow
const b = (s: string) => `\x1b[1m${s}\x1b[0m`;  // bold

// ── スキーマ定義 ──────────────────────────────
// type: Notionのプロパティ型名（複数指定で "どれかに一致" を許容）
// required: falseならプロパティ自体が存在しなくてもOK

type PropDef = {
  type: string | string[];
  required?: boolean;
};

type DBSchema = {
  label: string;
  envKey: string;
  props: Record<string, PropDef>;
};

const SCHEMAS: DBSchema[] = [
  {
    label: "①勤怠ログDB",
    envKey: "TIMELOG_DB_ID",
    props: {
      "タイトル":              { type: "title",     required: true  },
      "②従業員マスタDB_RM03P":   { type: "relation",  required: true  },
      "日付":                  { type: "date",      required: true  },
      "実打刻出勤":            { type: "date"                       },
      "実打刻退勤":            { type: "date"                       },
      "給与計算用出勤":        { type: "date"                       },
      "給与計算用退勤":        { type: "date"                       },
      "休憩":                  { type: "number"                          },
      "実働":                  { type: "formula"                    },
      "勤務状態":              { type: "select"                     },
      "備考":                  { type: "rich_text"                  },
      "承認":                  { type: ["select", "checkbox"]        },
    },
  },
  {
    label: "②従業員マスタDB",
    envKey: "EMPLOYEE_DB_ID",
    props: {
      "名前":       { type: "title",               required: true },
      "従業員ID":   { type: "rich_text"                          },
      "ステータス": { type: ["status", "select"],  required: true },
      "所属店舗":   { type: "select"                             },
    },
  },
  {
    label: "③店舗設定DB",
    envKey: "STORE_SETTINGS_DB_ID",
    props: {
      "店舗名":         { type: "title",      required: true },
      "定休曜日":       { type: "select"                    },
      "始業標準時刻":   { type: "rich_text"                 },
      "終業標準時刻":   { type: "rich_text"                 },
      "休憩時間":       { type: "number"                    },
      "みなし残業時間": { type: "number"                    },
      "アラート閾値":   { type: "number"                    },
    },
  },
  {
    label: "④保健師の一言DB",
    envKey: "TIPS_DB_ID",
    props: {
      "一言": { type: "title",    required: true },
      "有効": { type: "checkbox", required: true },
    },
  },
  {
    label: "⑤時間外申請DB",
    envKey: "OVERTIME_REQUEST_DB_ID",
    props: {
      "タイトル":   { type: "title",     required: true },
      "従業員":     { type: "relation",  required: true },
      "申請日":     { type: "date"                     },
      "早出申請":   { type: "checkbox"                 },
      "早出時刻":   { type: "rich_text"                },
      "早出理由":   { type: "rich_text"                },
      "残業申請":   { type: "checkbox"                 },
      "残業時刻":   { type: "rich_text"                },
      "残業理由":   { type: "rich_text"                },
      "ステータス": { type: ["status", "select"]       },
    },
  },
];

// ── チェック実行 ──────────────────────────────

async function checkDB(schema: DBSchema): Promise<boolean> {
  const dbId = process.env[schema.envKey];
  console.log(`\n${b(schema.label)} (${schema.envKey})`);
  const maskedId = dbId ? `...${dbId.slice(-5)}` : "未設定";
  console.log(`  ${"\x1b[2m"}${maskedId}${"\x1b[0m"}`);

  if (!dbId) {
    console.log(`  ${r("✗")} 環境変数 ${schema.envKey} が未設定`);
    return false;
  }

  let actualProps: Record<string, { type: string }>;
  try {
    const db = await notion.databases.retrieve({ database_id: dbId }) as any;
    actualProps = db.properties;
  } catch (e: any) {
    console.log(`  ${r("✗")} DB取得エラー: ${e?.message ?? String(e)}`);
    return false;
  }

  let allOk = true;
  for (const [propName, def] of Object.entries(schema.props)) {
    const actual = actualProps[propName];
    const expectedTypes = Array.isArray(def.type) ? def.type : [def.type];

    if (!actual) {
      if (def.required) {
        console.log(`  ${r("✗")} "${propName}" が存在しません（必須）`);
        allOk = false;
      } else {
        console.log(`  ${y("–")} "${propName}" が存在しません（任意）`);
      }
      continue;
    }

    if (!expectedTypes.includes(actual.type)) {
      console.log(`  ${r("✗")} "${propName}" の型が違います: 期待=${expectedTypes.join("/")} 実際=${actual.type}`);
      allOk = false;
    } else {
      console.log(`  ${g("✓")} "${propName}" (${actual.type})`);
    }
  }

  return allOk;
}

async function main() {
  console.log(b("\n=== Notion Schema Check ==="));

  if (!process.env.NOTION_API_KEY) {
    console.log(r("\nNOTION_API_KEY が未設定です。.env.local を確認してください。"));
    process.exit(1);
  }

  let totalOk = true;
  for (const schema of SCHEMAS) {
    const ok = await checkDB(schema);
    if (!ok) totalOk = false;
  }

  console.log("\n" + "─".repeat(40));
  if (totalOk) {
    console.log(g("✓ すべてのDBスキーマが一致しています"));
  } else {
    console.log(r("✗ スキーマの不一致があります。上記を確認してください"));
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(r("\n予期せぬエラー:"), e);
  process.exit(1);
});
