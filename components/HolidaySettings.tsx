"use client";

import { useEffect, useRef, useState } from "react";
import { adminFetch } from "@/lib/adminFetch";

type Employee = {
  id: string;
  name: string;
  employeeId: string;
  status: string;
  store: string;
};

type Popover = {
  dateStr: string;
  x: number;
  y: number;
  above: boolean;
  pendingEmpId?: string; // 設定済みの場合は 公休/有給 選択ステップを表示
};

const EMP_COLORS = [
  { pill: "bg-blue-500 text-white",   tag: "bg-blue-50 text-blue-500",   hover: "hover:bg-red-50 hover:text-red-400" },
  { pill: "bg-violet-500 text-white", tag: "bg-violet-50 text-violet-500", hover: "hover:bg-red-50 hover:text-red-400" },
  { pill: "bg-emerald-500 text-white",tag: "bg-emerald-50 text-emerald-500", hover: "hover:bg-red-50 hover:text-red-400" },
  { pill: "bg-amber-500 text-white",  tag: "bg-amber-50 text-amber-500",  hover: "hover:bg-red-50 hover:text-red-400" },
  { pill: "bg-rose-500 text-white",   tag: "bg-rose-50 text-rose-500",    hover: "hover:bg-red-50 hover:text-red-400" },
  { pill: "bg-cyan-500 text-white",   tag: "bg-cyan-50 text-cyan-500",    hover: "hover:bg-red-50 hover:text-red-400" },
  { pill: "bg-fuchsia-500 text-white",tag: "bg-fuchsia-50 text-fuchsia-500", hover: "hover:bg-red-50 hover:text-red-400" },
];

export default function HolidaySettings() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);

  const [stores, setStores] = useState<string[]>([]);
  const [selectedStore, setSelectedStore] = useState<string>("");

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [empLoading, setEmpLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [closingDay, setClosingDay] = useState(2); // 0=日 … 6=土
  const [storeSettingsMap, setStoreSettingsMap] = useState<Record<string, { id: string; closingDay: number }>>({});

  // 公休マップ: dateStr → { empId, notionPageId, type }[]
  const [holidayMap, setHolidayMap] = useState<Record<string, { empId: string; notionPageId: string; type: "公休" | "有給" }[]>>({});

  // コメント: employeeId → string
  const [comments, setComments] = useState<Record<string, string>>({});

  // 削除確認中のキー "dateStr_empId"
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);

  // 保存中エントリのキーセット "dateStr_empId"
  const [savingKeys, setSavingKeys] = useState<Set<string>>(new Set());

  // ドラッグ中の従業員ID（左パネルからの新規配置）
  const [draggingId, setDraggingId] = useState<string | null>(null);
  // ドラッグ中のカレンダー上の既存エントリ（移動）
  const [draggingSource, setDraggingSource] = useState<{ empId: string; fromDate: string; notionPageId: string; type: "公休" | "有給" } | null>(null);
  // ドラッグオーバー中の日付
  const [dragOverDate, setDragOverDate] = useState<string | null>(null);

  // ポップオーバー
  const [popover, setPopover] = useState<Popover | null>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  // 店舗設定取得
  useEffect(() => {
    adminFetch("/api/admin/store-settings")
      .then((r) => r.ok ? r.json() : Promise.reject())
      .then((data: { id: string; storeName: string; closingDay: number }[]) => {
        const map: Record<string, { id: string; closingDay: number }> = {};
        data.forEach((s) => { map[s.storeName] = { id: s.id, closingDay: s.closingDay }; });
        setStoreSettingsMap(map);
      })
      .catch(() => setLoadError(true));
  }, []);

  // 従業員一覧取得
  useEffect(() => {
    adminFetch("/api/admin/employees")
      .then((r) => r.ok ? r.json() : Promise.reject())
      .then((data: Employee[]) => {
        const sorted = [...data].sort((a, b) =>
          a.status === "退職" && b.status !== "退職" ? 1 : a.status !== "退職" && b.status === "退職" ? -1 : 0
        );
        setEmployees(sorted);
        const uniqueStores = [...new Set(sorted.map((e) => e.store).filter(Boolean))].sort((a, b) => b.localeCompare(a));
        setStores(uniqueStores);
        if (uniqueStores.length > 0) {
          setSelectedStore(uniqueStores[0]);
          const first = sorted.find((e) => e.store === uniqueStores[0]);
          if (first) setSelectedId(first.id);
        }
      })
      .catch(() => setLoadError(true))
      .finally(() => setEmpLoading(false));
  }, []);

  // 月の公休・有給レコードを初期ロード
  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/admin/holiday?year=${year}&month=${month}`, { signal: controller.signal })
      .then((r) => r.ok ? r.json() : Promise.reject())
      .then((data: { pageId: string; date: string; employeePageId: string; type: "公休" | "有給" }[]) => {
        const map: Record<string, { empId: string; notionPageId: string; type: "公休" | "有給" }[]> = {};
        data.forEach(({ pageId, date, employeePageId, type }) => {
          if (!map[date]) map[date] = [];
          map[date].push({ empId: employeePageId, notionPageId: pageId, type });
        });
        setHolidayMap(map);
      })
      .catch((e) => { if (e?.name !== "AbortError") { setHolidayMap({}); setLoadError(true); } });
    return () => controller.abort();
  }, [year, month]);

  // ポップオーバー外クリックで閉じる
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setPopover(null);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const prevMonth = () => {
    if (month === 1) { setYear((y) => y - 1); setMonth(12); }
    else setMonth((m) => m - 1);
  };
  const nextMonth = () => {
    if (month === 12) { setYear((y) => y + 1); setMonth(1); }
    else setMonth((m) => m + 1);
  };

  // 現在月の3ヶ月先までナビゲート可能（公休・有給の先行設定のため）
  const maxDate = new Date(now.getFullYear(), now.getMonth() + 3, 1);
  const maxYear = maxDate.getFullYear();
  const maxMonth = maxDate.getMonth() + 1;
  const isNextDisabled = year > maxYear || (year === maxYear && month >= maxMonth);

  const handleStoreChange = (store: string) => {
    setSelectedStore(store);
    const first = employees.find((e) => e.store === store && e.status !== "退職");
    setSelectedId(first?.id ?? null);
    setPopover(null);
    if (storeSettingsMap[store] !== undefined) setClosingDay(storeSettingsMap[store].closingDay);
  };

  // 店舗設定が読み込まれたら現在の店舗の定休日を反映
  useEffect(() => {
    if (selectedStore && storeSettingsMap[selectedStore] !== undefined) {
      setClosingDay(storeSettingsMap[selectedStore].closingDay);
    }
  }, [storeSettingsMap, selectedStore]);

  const filteredEmployees = employees.filter((e) => e.store === selectedStore);
  const selectedEmp = employees.find((e) => e.id === selectedId);

  const handleCellClick = (e: React.MouseEvent<HTMLButtonElement>, dateStr: string) => {
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    const popoverHeight = 200; // 概算
    const above = rect.bottom + popoverHeight > window.innerHeight;
    setPopover({ dateStr, x: rect.left, y: above ? rect.top - 4 : rect.bottom + 4, above });
  };

  const addHoliday = async (dateStr: string, empId: string, type: "公休" | "有給" = "公休") => {
    const emp = employees.find((e) => e.id === empId);
    if (!emp) return;
    setPopover(null);
    try {
      const res = await adminFetch("/api/admin/holiday", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ employeePageId: empId, employeeName: emp.name, date: dateStr, type }),
      });
      if (!res.ok) throw new Error();
      const { pageId } = await res.json();
      setHolidayMap((prev) => ({
        ...prev,
        [dateStr]: [...(prev[dateStr] ?? []), { empId, notionPageId: pageId, type }],
      }));
    } catch {
      alert("保存に失敗しました");
    }
  };

  const removeHoliday = async (dateStr: string, empId: string) => {
    const entry = (holidayMap[dateStr] ?? []).find((e) => e.empId === empId);
    if (!entry) return;
    // 楽観的UI更新
    setHolidayMap((prev) => ({
      ...prev,
      [dateStr]: (prev[dateStr] ?? []).filter((e) => e.empId !== empId),
    }));
    try {
      await adminFetch("/api/admin/holiday", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pageId: entry.notionPageId }),
      });
    } catch {
      // 失敗したら元に戻す
      setHolidayMap((prev) => ({
        ...prev,
        [dateStr]: [...(prev[dateStr] ?? []), entry],
      }));
    }
  };

  const moveHoliday = async (
    fromDate: string,
    toDate: string,
    entry: { empId: string; notionPageId: string; type: "公休" | "有給" }
  ) => {
    const key = `${fromDate}_${entry.empId}`;
    // 保存中は操作不可
    setSavingKeys((prev) => new Set(prev).add(key));
    // 楽観的UI更新
    setHolidayMap((prev) => {
      const next = { ...prev };
      next[fromDate] = (next[fromDate] ?? []).filter((e) => e.empId !== entry.empId);
      next[toDate] = [...(next[toDate] ?? []), entry];
      return next;
    });
    try {
      const res = await fetch(`/api/admin/records/${entry.notionPageId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date: fromDate, newDate: toDate }),
      });
      if (!res.ok) throw new Error();
    } catch {
      // ロールバック
      setHolidayMap((prev) => {
        const next = { ...prev };
        next[toDate] = (next[toDate] ?? []).filter((e) => e.empId !== entry.empId);
        next[fromDate] = [...(next[fromDate] ?? []), entry];
        return next;
      });
      alert("移動に失敗しました");
    } finally {
      setSavingKeys((prev) => { const s = new Set(prev); s.delete(key); return s; });
    }
  };

  // 今月の定休日の数
  const closingDaysCount = (() => {
    const days = new Date(year, month, 0).getDate();
    return Array.from({ length: days }, (_, i) => i + 1)
      .filter((d) => new Date(year, month - 1, d).getDay() === closingDay).length;
  })();

  // 従業員ごとの公休数（定休日 + 公休エントリ）
  const kyuuCountForEmp = (empId: string) =>
    closingDaysCount + Object.values(holidayMap).filter((entries) => entries.some((e) => e.empId === empId && e.type === "公休")).length;

  // 従業員ごとの有給数
  const yukyuCountForEmp = (empId: string) =>
    Object.values(holidayMap).filter((entries) => entries.some((e) => e.empId === empId && e.type === "有給")).length;

  // 従業員インデックスからカラーを取得
  const colorOf = (empId: string) => {
    const idx = filteredEmployees.findIndex((e) => e.id === empId);
    return EMP_COLORS[idx % EMP_COLORS.length] ?? EMP_COLORS[0];
  };

  if (loadError) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-4">
        <p className="text-sm text-gray-500">取得に失敗しました</p>
        <button onClick={() => window.location.reload()} className="px-5 py-2 text-sm font-bold text-clock-blue border border-clock-blue/30 rounded-full hover:bg-clock-blue/5">
          再読み込み
        </button>
      </div>
    );
  }

  if (empLoading) {
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

      {/* ── ヘッダー ── */}
      <div className="px-6 py-4 border-b border-gray-100 shrink-0">
        <div className="flex items-center gap-3">
          <div className="relative shrink-0">
            <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
                <polyline points="9 22 9 12 15 12 15 22" />
              </svg>
            </span>
            <select
              value={selectedStore}
              onChange={(e) => handleStoreChange(e.target.value)}
              className="appearance-none pl-8 pr-7 py-1.5 text-sm font-bold text-white bg-gray-600 rounded-full focus:outline-none focus:ring-2 focus:ring-gray-400/40 cursor-pointer"
            >
              {stores.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
            <svg className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-300" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 9l6 6 6-6" />
            </svg>
          </div>
          <span className="ml-auto text-base font-extrabold text-clock-blue tracking-wide shrink-0 pr-2">公休設定</span>
        </div>
      </div>

      {/* ── コンテンツエリア ── */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {selectedEmp ? (
          <>
            {/* メインエリア */}
            <div className="flex-1 flex overflow-hidden">

              {/* 左：定休日 + 従業員リスト */}
              <div className="w-[28%] min-w-[220px] max-w-[360px] shrink-0 border-r border-gray-100 flex flex-col px-3 py-3 overflow-y-auto">
                <p className="text-[10px] font-bold text-gray-300 tracking-wide mb-2 px-1">定休日</p>
                <div className="relative mb-4">
                  <select
                    value={closingDay}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      setClosingDay(val);
                      const pageId = storeSettingsMap[selectedStore]?.id;
                      if (pageId) {
                        adminFetch("/api/admin/store-settings", {
                          method: "PATCH",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ pageId, closingDay: val }),
                        });
                      }
                    }}
                    className="w-full appearance-none px-4 py-2 text-sm font-bold text-gray-500 bg-gray-100 rounded-full focus:outline-none cursor-pointer text-center"
                  >
                    {["日", "月", "火", "水", "木", "金", "土"].map((d, i) => (
                      <option key={d} value={i}>{d}曜日</option>
                    ))}
                  </select>
                  <svg className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M6 9l6 6 6-6" />
                  </svg>
                </div>

                <div className="flex items-center justify-between mb-2 px-1">
                  <p className="flex-1 text-[10px] font-bold text-gray-300 tracking-wide text-center">従業員</p>
                  <p className="text-[10px] font-bold text-gray-300 tracking-wide w-8 text-center">公休</p>
                  <p className="text-[10px] font-bold text-clock-blue/40 tracking-wide w-8 text-center">有給</p>
                </div>
                <div className="flex flex-col gap-1">
                  {filteredEmployees.map((emp) => {
                    const color = colorOf(emp.id);
                    return (
                      <div key={emp.id} className="flex flex-col gap-0.5">
                        <div className="flex items-center gap-1.5">
                          <button
                            draggable={emp.status !== "退職"}
                            onDragStart={() => setDraggingId(emp.id)}
                            onDragEnd={() => { setDraggingId(null); setDragOverDate(null); }}
                            onClick={() => setSelectedId(emp.id)}
                            className={`flex-1 px-3 py-1 rounded-full text-xs font-bold transition-all duration-200 ${
                              emp.status === "退職" ? "bg-gray-100 text-gray-300" : color.pill
                            } ${emp.status !== "退職" ? "cursor-grab active:cursor-grabbing" : ""}`}
                          >
                            {emp.name}
                          </button>
                          <span className="text-xs font-bold text-gray-400 tabular-nums w-6 text-center shrink-0">
                            {kyuuCountForEmp(emp.id)}
                          </span>
                          <span className="text-xs font-bold text-clock-blue/50 tabular-nums w-6 text-center shrink-0">
                            {yukyuCountForEmp(emp.id)}
                          </span>
                        </div>
                        <input
                          type="text"
                          value={comments[emp.id] ?? ""}
                          onChange={(e) => setComments((prev) => ({ ...prev, [emp.id]: e.target.value }))}
                          placeholder="コメント..."
                          className="w-full px-3 py-0.5 text-[11px] text-gray-500 bg-gray-50 rounded-full border border-gray-100 focus:outline-none focus:border-clock-blue/40 transition-colors placeholder:text-gray-200"
                        />
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* 右：カレンダー */}
              {(() => {
                const DOW = ["月", "火", "水", "木", "金", "土", "日"];
                const daysInMonth = new Date(year, month, 0).getDate();
                const firstDow = (new Date(year, month - 1, 1).getDay() + 6) % 7;
                const pad = (n: number) => String(n).padStart(2, "0");
                const today = new Date();
                const todayStr = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;

                const cells: (number | null)[] = [
                  ...Array(firstDow).fill(null),
                  ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
                ];
                while (cells.length % 7 !== 0) cells.push(null);

                return (
                  <div className="flex-1 flex flex-col mx-4 mb-4 mt-2 min-w-0 overflow-hidden">
                    {/* 月セレクター */}
                  <div className="flex justify-center items-center gap-2 py-2 mb-1">
                    <button onClick={prevMonth} className="p-1 text-gray-400 hover:text-gray-600 transition-colors">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M15 18l-6-6 6-6" />
                      </svg>
                    </button>
                    <span className="text-sm font-bold text-gray-500 tabular-nums w-20 text-center">{year}年{month}月</span>
                    <button
                      onClick={nextMonth}
                      disabled={isNextDisabled}
                      className={`p-1 transition-colors ${isNextDisabled ? "text-gray-200 cursor-not-allowed" : "text-gray-400 hover:text-gray-600"}`}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M9 18l6-6-6-6" />
                      </svg>
                    </button>
                  </div>

                  <div className="grid grid-cols-7 mb-1">
                      {DOW.map((d, i) => (
                        <div key={d} className={`text-center text-[11px] font-bold py-1 ${i === 5 ? "text-clock-blue" : i === 6 ? "text-red-400" : "text-gray-300"}`}>
                          {d}
                        </div>
                      ))}
                    </div>
                    <div className="flex-1 grid grid-cols-7" style={{ gridTemplateRows: `repeat(${cells.length / 7}, 1fr)` }}>
                      {cells.map((d, idx) => {
                        if (d === null) return <div key={`empty-${idx}`} className="border-b border-r border-gray-50" />;
                        const rawDow = new Date(year, month - 1, d).getDay();
                        const pad = (n: number) => String(n).padStart(2, "0");
                        const dateStr = `${year}-${pad(month)}-${pad(d)}`;
                        const isToday = dateStr === todayStr;
                        const isSun = rawDow === 0;
                        const isSat = rawDow === 6;
                        const isClosingDay = rawDow === closingDay;
                        const assignedEntries = (holidayMap[dateStr] ?? []).filter(
                          (e) => filteredEmployees.some((fe) => fe.id === e.empId)
                        );

                        const isDragTarget = dragOverDate === dateStr;
                        return (
                          <button
                            key={d}
                            onClick={(e) => handleCellClick(e, dateStr)}
                            onDragOver={(e) => { e.preventDefault(); setDragOverDate(dateStr); }}
                            onDragLeave={() => setDragOverDate(null)}
                            onDrop={(e) => {
                              e.preventDefault();
                              setDragOverDate(null);
                              if (draggingSource) {
                                // カレンダー上のピルを別の日付に移動
                                if (
                                  draggingSource.fromDate !== dateStr &&
                                  !assignedEntries.some((e) => e.empId === draggingSource.empId)
                                ) {
                                  moveHoliday(draggingSource.fromDate, dateStr, draggingSource);
                                }
                                setDraggingSource(null);
                              } else if (draggingId && !assignedEntries.some((e) => e.empId === draggingId)) {
                                // 左パネルからの新規配置 → 種別選択ポップオーバー
                                const rect = e.currentTarget.getBoundingClientRect();
                                const popoverHeight = 100;
                                const above = rect.bottom + popoverHeight > window.innerHeight;
                                setPopover({ dateStr, x: rect.left, y: above ? rect.top - 4 : rect.bottom + 4, above, pendingEmpId: draggingId });
                              }
                            }}
                            className={`flex flex-col items-center justify-start pt-1.5 border-b border-r border-gray-50 transition-colors gap-1 overflow-hidden px-1 ${
                              isDragTarget ? "bg-orange-100/70 ring-2 ring-inset ring-orange-300" :
                              isClosingDay ? "bg-orange-50/50" : isToday ? "bg-blue-50/60" : isSat || isSun ? "bg-gray-50/40" : "hover:bg-orange-50/40"
                            }`}
                          >
                            <span className={`text-sm tabular-nums font-medium shrink-0 ${
                              isToday ? "text-clock-blue font-bold" : isSun ? "text-red-400" : isSat ? "text-clock-blue" : "text-gray-500"
                            }`}>
                              {d}
                            </span>
                            {isClosingDay && (
                              <span className="text-[10px] font-bold text-orange-300 bg-orange-100 rounded-full px-2 py-0.5 leading-none shrink-0">
                                定休日
                              </span>
                            )}
                            {assignedEntries.map((entry) => {
                              const emp = employees.find((e) => e.id === entry.empId);
                              if (!emp) return null;
                              const c = colorOf(entry.empId);
                              const key = `${dateStr}_${entry.empId}`;
                              const isPending = pendingDelete === key;
                              const isSaving = savingKeys.has(key);
                              return (
                                <span
                                  key={entry.empId}
                                  draggable={!isSaving}
                                  onDragStart={(ev) => {
                                    if (isSaving) { ev.preventDefault(); return; }
                                    ev.stopPropagation();
                                    setDraggingSource({ empId: entry.empId, fromDate: dateStr, notionPageId: entry.notionPageId, type: entry.type });
                                    setDraggingId(null);
                                  }}
                                  onDragEnd={() => { setDraggingSource(null); setDragOverDate(null); }}
                                  onClick={(ev) => {
                                    if (isSaving) return;
                                    ev.stopPropagation();
                                    if (isPending) { removeHoliday(dateStr, entry.empId); setPendingDelete(null); }
                                    else setPendingDelete(key);
                                  }}
                                  onBlur={() => setPendingDelete(null)}
                                  className={`text-[10px] font-bold rounded-full px-2 py-0.5 leading-none shrink-0 transition-all ${
                                    isSaving ? "opacity-40 cursor-wait" :
                                    isPending ? "bg-red-400 text-white scale-105 cursor-pointer" :
                                    `cursor-grab active:cursor-grabbing ${entry.type === "有給" ? "bg-emerald-500 text-white hover:opacity-70" : `${c.pill} hover:opacity-70`}`
                                  }`}
                                >
                                  {isPending ? "消す？" : entry.type === "有給" ? `${emp.name}(有)` : emp.name}
                                </span>
                              );
                            })}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}

            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-sm text-gray-200">従業員を選択してください</p>
          </div>
        )}
      </div>

      {/* ポップオーバー */}
      {popover && (
        <div
          ref={popoverRef}
          className="fixed z-50 bg-white rounded-2xl shadow-lg border border-gray-100 py-2 min-w-[140px]"
          style={popover.above
            ? { left: popover.x, bottom: window.innerHeight - popover.y }
            : { left: popover.x, top: popover.y }
          }
        >
          {popover.pendingEmpId ? (
            /* ステップ2: 公休 / 有給 選択 */
            <div className="px-3 py-2 flex flex-col items-center gap-1.5">
              <button
                onClick={() => addHoliday(popover.dateStr, popover.pendingEmpId!, "公休")}
                className="w-full px-4 py-2 text-sm font-bold rounded-full bg-orange-400 text-white hover:bg-orange-500 transition-colors"
              >
                公休
              </button>
              <button
                onClick={() => addHoliday(popover.dateStr, popover.pendingEmpId!, "有給")}
                className="text-[11px] font-bold text-gray-300 hover:text-emerald-500 transition-colors py-0.5"
              >
                有給にする
              </button>
            </div>
          ) : (
            /* ステップ1: 従業員選択 */
            <>
              {filteredEmployees
                .filter((e) => e.status !== "退職" && !(holidayMap[popover.dateStr] ?? []).some((h) => h.empId === e.id))
                .map((emp) => (
                  <button
                    key={emp.id}
                    onClick={() => setPopover((prev) => prev ? { ...prev, pendingEmpId: emp.id } : null)}
                    className="w-full px-4 py-2 text-sm font-bold text-gray-600 hover:bg-gray-50 text-left transition-colors"
                  >
                    {emp.name}
                  </button>
                ))}
              {filteredEmployees.filter((e) => e.status !== "退職" && !(holidayMap[popover.dateStr] ?? []).some((h) => h.empId === e.id)).length === 0 && (
                <p className="px-4 py-2 text-xs text-gray-300">全員設定済み</p>
              )}
            </>
          )}
        </div>
      )}

    </div>
  );
}
