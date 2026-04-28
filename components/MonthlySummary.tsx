"use client";

import { useEffect, useState } from "react";
import { adminFetch } from "@/lib/adminFetch";
import { motion, AnimatePresence } from "framer-motion";

type Employee = {
  id: string;
  name: string;
  employeeId: string;
  status: string;
  store: string;
};

type MonthlyRecord = {
  id: string;
  date: string;
  clockIn: string;
  clockOut: string;
  break: string;
  actualHours: number | null;
  workStatus: string;
  note: string;
  approved: boolean;
  requestStatus: "" | "承認待ち" | "承認済";
};

export default function MonthlySummary() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);

  const [stores, setStores] = useState<string[]>([]);
  const [selectedStore, setSelectedStore] = useState<string>("");

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [empLoading, setEmpLoading] = useState(true);
  const [empError, setEmpError] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const [records, setRecords] = useState<MonthlyRecord[]>([]);
  const [recordsLoading, setRecordsLoading] = useState(false);
  const [recordsError, setRecordsError] = useState(false);

  // 店舗ごとの定休曜日 (0=日…6=土)
  const [storeClosingDay, setStoreClosingDay] = useState<number | null>(null);

  // インライン編集
  const [editingCell, setEditingCell] = useState<{ recId: string; field: string } | null>(null);
  const [editValue, setEditValue] = useState("");
  const [savingId, setSavingId] = useState<string | null>(null);

  // CSV出力モーダル
  const [showCsvModal, setShowCsvModal] = useState(false);

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
      .catch(() => setEmpError(true))
      .finally(() => setEmpLoading(false));
  }, []);

  // 店舗設定取得（従業員の店舗の定休曜日）
  useEffect(() => {
    const store = employees.find((e) => e.id === selectedId)?.store;
    if (!store) { setStoreClosingDay(null); return; }
    adminFetch("/api/admin/store-settings")
      .then((r) => r.ok ? r.json() : Promise.reject())
      .then((data: { id: string; storeName: string; closingDay: number }[]) => {
        const setting = data.find((s) => s.storeName === store);
        setStoreClosingDay(setting?.closingDay ?? null);
      })
      .catch(() => setStoreClosingDay(null));
  }, [selectedId, employees]);

  // 月次レコード取得
  const fetchRecords = (id: string, y: number, m: number, signal?: AbortSignal) => {
    setRecordsLoading(true);
    setRecordsError(false);
    return fetch(`/api/admin/monthly?employeeId=${id}&year=${y}&month=${m}`, { signal })
      .then((r) => r.ok ? r.json() : Promise.reject())
      .then((data: MonthlyRecord[]) => setRecords(data))
      .catch((e) => { if (e?.name !== "AbortError") { setRecords([]); setRecordsError(true); } })
      .finally(() => setRecordsLoading(false));
  };

  useEffect(() => {
    if (!selectedId) return;
    const controller = new AbortController();
    fetchRecords(selectedId, year, month, controller.signal);
    return () => controller.abort();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, year, month]);

  const saveCell = async (rec: MonthlyRecord, field: string, value: string) => {
    setEditingCell(null);
    if (!selectedId) return;
    // 楽観的UI更新
    setRecords((prev) => prev.map((r) =>
      r.id === rec.id ? { ...r, [field]: value } : r
    ));
    setSavingId(rec.id);
    try {
      const res = await fetch(`/api/admin/records/${rec.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date: rec.date, [field]: value }),
      });
      if (!res.ok) throw new Error();
      // 実働（formula）を反映するため再取得
      await fetchRecords(selectedId, year, month);
    } catch {
      // ロールバック
      setRecords((prev) => prev.map((r) => r.id === rec.id ? rec : r));
      alert("更新に失敗しました");
    } finally {
      setSavingId(null);
    }
  };

  const prevMonth = () => {
    if (month === 1) { setYear((y) => y - 1); setMonth(12); }
    else setMonth((m) => m - 1);
  };
  const nextMonth = () => {
    if (month === 12) { setYear((y) => y + 1); setMonth(1); }
    else setMonth((m) => m + 1);
  };

  // 現在月の3ヶ月先までナビゲート可能（公休・有給の先行設定を確認するため）
  const maxDate = new Date(now.getFullYear(), now.getMonth() + 3, 1);
  const maxYear = maxDate.getFullYear();
  const maxMonth = maxDate.getMonth() + 1;
  const isNextDisabled = year > maxYear || (year === maxYear && month >= maxMonth);

  const handleStoreChange = (store: string) => {
    setSelectedStore(store);
    const first = employees.find((e) => e.store === store && e.status !== "退職");
    setSelectedId(first?.id ?? null);
  };

  const filteredEmployees = employees.filter((e) => e.store === selectedStore);
  const selectedEmp = employees.find((e) => e.id === selectedId);

  // dateStr → レコードのマップ
  const recordMap = new Map(records.map((r) => [r.date, r]));

  const handleCsvExport = () => {
    if (!selectedEmp) return;
    const DOW = ["日", "月", "火", "水", "木", "金", "土"];
    const pad = (n: number) => String(n).padStart(2, "0");
    const daysInMonth = new Date(year, month, 0).getDate();

    const headers = ["日付", "出勤", "退勤", "休憩", "実働", "勤務状態", "備考"];
    const rows = Array.from({ length: daysInMonth }, (_, i) => {
      const d = i + 1;
      const dow = new Date(year, month - 1, d).getDay();
      const dateStr = `${year}-${pad(month)}-${pad(d)}`;
      const rec = recordMap.get(dateStr);
      return [
        `${month}/${d}(${DOW[dow]})`,
        rec?.clockIn || "",
        rec?.clockOut || "",
        rec?.break || "",
        rec?.actualHours != null ? rec.actualHours.toFixed(1) : "",
        rec?.workStatus || "",
        rec?.note || "",
      ];
    });

    const csv = [headers, ...rows]
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
      .join("\r\n");

    const bom = "\uFEFF";
    const blob = new Blob([bom + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${year}-${pad(month)}_${selectedEmp.name}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const totalHours = records.reduce((sum, r) => sum + (r.actualHours ?? 0), 0);
  const totalDays = records.filter((r) => r.clockIn).length;
  const paidLeaveCount = records.filter((r) => r.workStatus === "有給").length;

  // 公休数 = 公休レコード数 + 定休日数（定休曜日かつレコードが無い日）
  const recordedDates = new Set(records.map((r) => r.date));
  let closingDayCount = 0;
  if (storeClosingDay !== null) {
    const daysInMonth = new Date(year, month, 0).getDate();
    const pad = (n: number) => String(n).padStart(2, "0");
    for (let d = 1; d <= daysInMonth; d++) {
      if (new Date(year, month - 1, d).getDay() === storeClosingDay) {
        const dateStr = `${year}-${pad(month)}-${pad(d)}`;
        if (!recordedDates.has(dateStr)) closingDayCount++;
      }
    }
  }
  const holidayCount = records.filter((r) => r.workStatus === "公休").length + closingDayCount;

  if (empError) {
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
          {/* 店舗プルダウン */}
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

          {/* 従業員ピル */}
          <div className="flex-1 flex flex-wrap gap-2 items-center">
            {filteredEmployees.map((emp) => (
              <button
                key={emp.id}
                onClick={() => setSelectedId(emp.id)}
                className={`px-4 py-1.5 rounded-full text-sm font-bold transition-all duration-200 ${
                  selectedId === emp.id
                    ? "bg-clock-blue text-white shadow-sm"
                    : emp.status === "退職"
                    ? "bg-gray-100 text-gray-300"
                    : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                }`}
              >
                {emp.name}
              </button>
            ))}
          </div>

          {/* タイトル */}
          <span className="text-base font-extrabold text-clock-blue tracking-wide shrink-0 pr-2">月次集計</span>
        </div>
      </div>

      {/* ── コンテンツエリア ── */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {selectedEmp ? (
          <>
            {/* 従業員情報 + 月セレクター */}
            <div className="px-6 py-3 border-b border-gray-100 flex items-center gap-10">
              {[
                { label: "名前",       value: selectedEmp.name },
                { label: "従業員ID",   value: selectedEmp.employeeId || "—" },
                { label: "ステータス", value: selectedEmp.status },
                { label: "所属店舗",   value: selectedEmp.store || "—" },
              ].map(({ label, value }) => (
                <div key={label} className="flex flex-col gap-0.5">
                  <p className="text-[10px] text-gray-300 tracking-wide">{label}</p>
                  <p className="text-sm text-gray-500">{value}</p>
                </div>
              ))}
              <div className="ml-auto flex items-center gap-2">
                <button onClick={prevMonth} className="p-1 text-gray-400 hover:text-gray-600 transition-colors">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M15 18l-6-6 6-6" />
                  </svg>
                </button>
                <span className="text-sm font-bold text-gray-500 tabular-nums w-20 text-center">
                  {year}年{month}月
                </span>
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
            </div>

            {/* 日別テーブル（2列） */}
            {(() => {
              const DOW = ["日", "月", "火", "水", "木", "金", "土"];
              const daysInMonth = new Date(year, month, 0).getDate();
              const half = Math.ceil(daysInMonth / 2);
              const today = new Date();
              const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

              const COLS = "grid-cols-[56px_1fr_1fr_36px_36px_72px_1fr_44px]";

              const renderCol = (from: number, to: number) => (
                <div className="flex-1 flex flex-col min-w-0">
                  {/* 列ヘッダー */}
                  <div className={`grid ${COLS} gap-x-2 px-4 py-2 border-b border-gray-100 bg-white shrink-0`}>
                    {["日付", "出勤", "退勤", "休憩", "実働", "勤務状態", "備考", "承認"].map((h) => (
                      <span key={h} className="text-[10px] font-bold text-gray-300 tracking-wide">{h}</span>
                    ))}
                  </div>
                  {/* 日付行 */}
                  <div className="flex-1 flex flex-col">
                    {Array.from({ length: to - from + 1 }, (_, i) => {
                      const d = from + i;
                      const date = new Date(year, month - 1, d);
                      const dow = date.getDay();
                      const pad = (n: number) => String(n).padStart(2, "0");
                      const dateStr = `${year}-${pad(month)}-${pad(d)}`;
                      const isToday = dateStr === todayStr;
                      const isSat = dow === 6;
                      const isSun = dow === 0;
                      const rec = recordMap.get(dateStr);
                      const isClosingDay = storeClosingDay !== null && dow === storeClosingDay && !rec;
                      const effectiveStatus = rec?.workStatus || (isClosingDay ? "定休日" : "");
                      const isSaving = rec && savingId === rec.id;

                      const statusBadge = (status: string) => {
                        if (status === "定休日") return <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-orange-100 text-orange-400">{status}</span>;
                        if (status === "公休")   return <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-500">{status}</span>;
                        if (status === "有給")   return <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-600">{status}</span>;
                        if (status === "出勤")   return <span className="text-xs text-gray-500">{status}</span>;
                        return status ? <span className="text-xs text-gray-400">{status}</span> : <span className="text-gray-200 text-xs">—</span>;
                      };

                      // インライン編集セルのヘルパー
                      const isEditing = (field: string) =>
                        rec && editingCell?.recId === rec.id && editingCell?.field === field;

                      const startEdit = (field: string, current: string) => {
                        if (!rec) return;
                        setEditingCell({ recId: rec.id, field });
                        setEditValue(current);
                      };

                      const commitEdit = (field: string) => {
                        if (rec) saveCell(rec, field, editValue);
                      };

                      const inputProps = (field: string) => ({
                        value: editValue,
                        autoFocus: true,
                        onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setEditValue(e.target.value),
                        onBlur: () => commitEdit(field),
                        onKeyDown: (e: React.KeyboardEvent) => {
                          if (e.key === "Enter") commitEdit(field);
                          if (e.key === "Escape") setEditingCell(null);
                        },
                        className: "w-full text-xs bg-transparent border-b border-clock-blue focus:outline-none tabular-nums",
                      });

                      return (
                        <div
                          key={d}
                          className={`flex-1 grid ${COLS} gap-x-2 px-4 items-center border-b border-gray-50 ${
                            isSaving ? "opacity-50" :
                            isToday ? "bg-blue-50/60" : isClosingDay ? "bg-orange-50/40" : isSat || isSun ? "bg-gray-50/70" : ""
                          }`}
                        >
                          {/* 日付（編集不可） */}
                          <span className={`text-xs tabular-nums ${isToday ? "font-bold text-clock-blue" : isSun ? "text-red-400" : isSat ? "text-clock-blue" : "text-gray-500"}`}>
                            {month}/{d} <span className="font-bold">{DOW[dow]}</span>
                          </span>
                          {/* 出勤 */}
                          {rec ? isEditing("clockIn") ? (
                            <input type="time" {...inputProps("clockIn")} />
                          ) : (
                            <span onClick={() => startEdit("clockIn", rec.clockIn)} className={`text-xs tabular-nums cursor-pointer hover:text-clock-blue transition-colors ${rec.clockIn ? "text-gray-600" : "text-gray-200"}`}>
                              {rec.clockIn || "—"}
                            </span>
                          ) : <span className="text-gray-200 text-xs">—</span>}
                          {/* 退勤 */}
                          {rec ? isEditing("clockOut") ? (
                            <input type="time" {...inputProps("clockOut")} />
                          ) : (
                            <span onClick={() => startEdit("clockOut", rec.clockOut)} className={`text-xs tabular-nums cursor-pointer hover:text-clock-blue transition-colors ${rec.clockOut ? "text-gray-600" : "text-gray-200"}`}>
                              {rec.clockOut || "—"}
                            </span>
                          ) : <span className="text-gray-200 text-xs">—</span>}
                          {/* 休憩（編集不可・店舗別設定で管理） */}
                          <span className={`text-xs tabular-nums ${rec?.break ? "text-gray-500" : "text-gray-200"}`}>
                            {rec?.break || "—"}
                          </span>
                          {/* 実働（編集不可・formula） */}
                          <span className={`text-xs tabular-nums ${rec?.actualHours != null ? "text-gray-600 font-medium" : "text-gray-200"}`}>
                            {rec?.actualHours != null ? rec.actualHours.toFixed(1) : "—"}
                          </span>
                          {/* 勤務状態 */}
                          {rec ? isEditing("workStatus") ? (
                            <select {...inputProps("workStatus") as any} className="w-full text-xs bg-white border-b border-clock-blue focus:outline-none">
                              {["出勤", "公休", "有給", "欠勤"].map((o) => (
                                <option key={o} value={o}>{o}</option>
                              ))}
                            </select>
                          ) : (
                            <span onClick={() => startEdit("workStatus", rec.workStatus)} className="cursor-pointer">
                              {statusBadge(rec.workStatus)}
                            </span>
                          ) : statusBadge(effectiveStatus)}
                          {/* 備考 */}
                          {rec ? isEditing("note") ? (
                            <input {...inputProps("note")} placeholder="備考..." />
                          ) : (
                            <span onClick={() => startEdit("note", rec.note)} className={`text-xs truncate cursor-pointer hover:text-clock-blue transition-colors ${rec.note ? "text-gray-500" : "text-gray-200"}`}>
                              {rec.note || "—"}
                            </span>
                          ) : <span className="text-gray-200 text-xs">—</span>}
                          {/* 承認（時間外申請ステータス・編集不可） */}
                          <span className="text-xs">
                            {rec?.requestStatus === "承認済" ? (
                              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-blue-50 text-clock-blue">承認済</span>
                            ) : rec?.requestStatus === "承認待ち" ? (
                              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-slate-100 text-gray-500">承認待ち</span>
                            ) : (
                              <span className="text-gray-200">—</span>
                            )}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );

              return (
                <div className="flex-1 flex overflow-hidden divide-x divide-gray-100 relative mx-4 mb-4 mt-2">
                  {recordsLoading && (
                    <div className="absolute inset-0 bg-white/70 flex flex-col items-center justify-center z-10 gap-3">
                      <svg className="w-6 h-6 animate-spin text-clock-blue" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-20" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-90" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                      </svg>
                      <p className="text-[10px] font-bold text-gray-400 tracking-[0.2em]">NOTION 連携中</p>
                    </div>
                  )}
                  {recordsError && !recordsLoading && (
                    <div className="absolute inset-0 bg-white/90 flex flex-col items-center justify-center z-10 gap-3">
                      <p className="text-sm text-gray-500">取得に失敗しました</p>
                      <button onClick={() => window.location.reload()} className="px-4 py-1.5 text-xs font-bold text-clock-blue border border-clock-blue/30 rounded-full hover:bg-clock-blue/5">再読み込み</button>
                    </div>
                  )}
                  {renderCol(1, half)}
                  {renderCol(half + 1, daysInMonth)}
                </div>
              );
            })()}

            {/* 合計バー */}
            <div className="px-6 py-3 border-t border-gray-100 flex items-center justify-end gap-10 shrink-0">
              {[
                { label: "合計出勤日数", value: `${totalDays}日` },
                { label: "合計実働時間", value: `${totalHours.toFixed(1)}h` },
                { label: "公休数",       value: `${holidayCount}日` },
                { label: "有給数",       value: `${paidLeaveCount}日` },
              ].map(({ label, value }) => (
                <div key={label} className="flex flex-col gap-0.5 items-end">
                  <p className="text-[10px] text-gray-300 tracking-wide">{label}</p>
                  <p className="text-sm text-gray-500">{value}</p>
                </div>
              ))}
              <button onClick={() => setShowCsvModal(true)} className="flex items-center gap-1.5 px-4 py-1.5 text-sm font-bold text-clock-blue border-2 border-clock-blue/20 rounded-full hover:bg-clock-blue/5 transition-colors">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
                CSV出力
              </button>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-sm text-gray-200">従業員を選択してください</p>
          </div>
        )}
      </div>

      {/* CSV出力：開発中モーダル */}
      <AnimatePresence>
        {showCsvModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 flex items-center justify-center px-8 z-50"
            onClick={() => setShowCsvModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="bg-white rounded-3xl px-8 py-7 w-full max-w-[340px] shadow-xl text-center"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-clock-blue/10 mb-4">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-clock-blue">
                  <circle cx="12" cy="12" r="10" />
                  <path d="M12 8v4M12 16h.01" />
                </svg>
              </div>
              <p className="text-base font-extrabold text-gray-700 mb-2">CSV出力</p>
              <p className="text-sm text-gray-400 mb-6">この機能は現在開発中です</p>
              <button
                onClick={() => setShowCsvModal(false)}
                className="w-full py-3 text-sm font-bold text-white bg-clock-blue rounded-2xl hover:bg-clock-blue/90 transition-colors"
              >
                閉じる
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}
