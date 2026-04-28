"use client";

import { useEffect, useState } from "react";
import { adminFetch } from "@/lib/adminFetch";

type StoreInfo = { id: string; storeName: string; closingDay: number };

type Settings = {
  id: string;
  startTime: string;
  endTime: string;
  breakHours: number;
  deemedOvertimeHours: number;
  alertThreshold: number;
};

const DEFAULT_SETTINGS: Settings = {
  id: "",
  startTime: "09:00",
  endTime: "18:00",
  breakHours: 2.5,
  deemedOvertimeHours: 30,
  alertThreshold: 80,
};

type FieldConfig =
  | { type: "time"; key: keyof Settings; label: string; unit?: string }
  | { type: "number"; key: keyof Settings; label: string; unit: string; min: number; max: number; step?: number };

const FIELDS: { section: string; desc: string; items: FieldConfig[] }[] = [
  {
    section: "所定労働時間",
    desc: "給与計算用打刻に使用する標準時刻を設定します",
    items: [
      { type: "time", key: "startTime", label: "始業標準時刻" },
      { type: "time", key: "endTime",   label: "終業標準時刻" },
    ],
  },
  {
    section: "休憩時間",
    desc: "退勤打刻時に勤怠ログの「休憩」欄に書き込まれる時間です",
    items: [
      { type: "number", key: "breakHours", label: "休憩時間", unit: "時間", min: 0, max: 8, step: 0.1 },
    ],
  },
  {
    section: "みなし残業管理",
    desc: "実打刻と給与計算用打刻の差分がアラート閾値を超えた場合に通知します",
    items: [
      { type: "number", key: "deemedOvertimeHours", label: "みなし残業時間", unit: "時間／月", min: 0, max: 80 },
      { type: "number", key: "alertThreshold",      label: "アラート閾値",   unit: "%",       min: 0, max: 100 },
    ],
  },
];

export default function PayrollSettings() {
  const [stores, setStores] = useState<StoreInfo[]>([]);
  const [selectedPageId, setSelectedPageId] = useState<string>("");

  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [storesLoading, setStoresLoading] = useState(true);
  const [settingsLoading, setSettingsLoading] = useState(false);
  const [editing, setEditing] = useState<keyof Settings | null>(null);
  const [draft, setDraft] = useState<string>("");
  const [saved, setSaved] = useState(false);

  // 店舗リスト取得（初回のみ）
  useEffect(() => {
    adminFetch("/api/admin/store-settings")
      .then((r) => r.ok ? r.json() : Promise.reject(new Error()))
      .then((data: StoreInfo[]) => {
        const sorted = [...data].sort((a, b) => b.storeName.localeCompare(a.storeName));
        setStores(sorted);
        if (sorted.length > 0) setSelectedPageId(sorted[0].id);
      })
      .catch(() => {})
      .finally(() => setStoresLoading(false));
  }, []);

  // 店舗が変わるたびに設定を再取得
  useEffect(() => {
    if (!selectedPageId) return;
    setSettingsLoading(true);
    setSaved(false);
    adminFetch(`/api/admin/payroll?pageId=${selectedPageId}`)
      .then((r) => r.ok ? r.json() : Promise.reject(new Error()))
      .then((data: Settings) => setSettings(data))
      .catch(() => {})
      .finally(() => setSettingsLoading(false));
  }, [selectedPageId]);

  const startEdit = (key: keyof Settings) => {
    setEditing(key);
    setDraft(String(settings[key]));
    setSaved(false);
  };

  const commitEdit = () => {
    if (!editing) return;
    setSettings((prev) => ({ ...prev, [editing]: typeof prev[editing] === "number" ? Number(draft) : draft }));
    setEditing(null);
  };

  const handleSave = async () => {
    try {
      const res = await adminFetch("/api/admin/payroll", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert(`保存に失敗しました\n${data.detail ?? data.error ?? res.status}`);
        return;
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e: any) {
      alert(`保存に失敗しました\n${e?.message ?? String(e)}`);
    }
  };

  const alertAt = Math.round(settings.deemedOvertimeHours * settings.alertThreshold / 100);

  if (storesLoading) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-3">
        <svg className="w-7 h-7 animate-spin text-clock-blue" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-20" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-90" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
        </svg>
        <p className="text-[10px] font-bold text-gray-400 tracking-[0.2em]">NOTION 連携中</p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* 店舗セレクター */}
      <div className="px-6 py-4 border-b border-gray-100 shrink-0">
        <div className="relative inline-block">
          <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
            </svg>
          </span>
          <select
            value={selectedPageId}
            onChange={(e) => setSelectedPageId(e.target.value)}
            className="appearance-none pl-8 pr-7 py-1.5 text-sm font-bold text-white bg-gray-600 rounded-full focus:outline-none focus:ring-2 focus:ring-gray-400/40 cursor-pointer"
          >
            {stores.map((s) => (
              <option key={s.id} value={s.id}>{s.storeName}</option>
            ))}
          </select>
          <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-white/70">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
              <path d="M6 9l6 6 6-6" />
            </svg>
          </span>
        </div>
      </div>

      {settingsLoading ? (
        <div className="flex-1 flex items-center justify-center">
          <svg className="w-6 h-6 animate-spin text-clock-blue" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-20" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-90" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
          </svg>
        </div>
      ) : (
        <>
          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
            {FIELDS.map((group) => (
              <div key={group.section}>
                <p className="text-xs font-bold text-gray-400 tracking-wide mb-0.5">{group.section}</p>
                <p className="text-[11px] text-gray-300 mb-3">{group.desc}</p>

                <div className="bg-slate-100 rounded-2xl overflow-hidden">
                  {group.items.map((item, i) => (
                    <div
                      key={item.key}
                      className={`flex items-center px-4 py-3.5 ${i !== group.items.length - 1 ? "border-b border-gray-100" : ""}`}
                    >
                      <span className="flex-1 text-sm text-gray-600">{item.label}</span>

                      {editing === item.key ? (
                        <div className="flex items-center gap-2">
                          <input
                            type={item.type}
                            value={draft}
                            onChange={(e) => setDraft(e.target.value)}
                            onBlur={commitEdit}
                            onKeyDown={(e) => e.key === "Enter" && commitEdit()}
                            autoFocus
                            {...(item.type === "number" ? { min: item.min, max: item.max, step: item.step ?? 1 } : {})}
                            className="w-24 px-2 py-1 text-sm text-right rounded-lg border-2 border-clock-blue/40 bg-white focus:outline-none"
                          />
                          {item.unit && <span className="text-xs text-gray-400">{item.unit}</span>}
                        </div>
                      ) : (
                        <button
                          onClick={() => startEdit(item.key)}
                          className="flex items-center gap-2 group"
                        >
                          <span className="text-sm font-bold text-clock-blue">
                            {String(settings[item.key])}{item.unit ? ` ${item.unit}` : ""}
                          </span>
                          <svg className="w-3.5 h-3.5 text-gray-300 group-hover:text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                            <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
                            <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
                          </svg>
                        </button>
                      )}
                    </div>
                  ))}
                </div>

                {group.section === "みなし残業管理" && (
                  <div className="mt-2 px-4 py-3 bg-blue-50 rounded-2xl space-y-1">
                    <p className="text-xs text-blue-300">
                      累積（実打刻 − 給与計算用打刻）&gt; {settings.deemedOvertimeHours}時間 × {settings.alertThreshold}% = {alertAt}時間／月
                    </p>
                    <p className="text-xs text-clock-blue">
                      月間 <span className="font-bold">{alertAt}時間</span> を超えるとアラートが発動します
                    </p>
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="px-6 py-4 border-t border-gray-100">
            <button
              onClick={handleSave}
              className={`w-full py-3 text-sm font-bold rounded-2xl transition-all duration-300 ${
                saved ? "bg-green-400 text-white" : "bg-clock-blue text-white"
              }`}
            >
              {saved ? "保存しました ✓" : "保存"}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
