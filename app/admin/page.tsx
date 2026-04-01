"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import PayrollSettings from "@/components/PayrollSettings";
import AppSettings from "@/components/AppSettings";

type Tab = "payroll" | "employees" | "tips" | "settings";

type Tip = {
  id: string;
  text: string;
  enabled: boolean;
};

type EmployeeAdmin = {
  id: string;
  name: string;
  employeeId: string;
  status: string;
};

const TABS: { id: Tab; label: string }[] = [
  { id: "payroll", label: "給与計算用" },
  { id: "employees", label: "従業員マスタ" },
  { id: "tips", label: "保健師の一言" },
  { id: "settings", label: "設定" },
];

function Spinner() {
  return (
    <div className="flex justify-center py-12">
      <svg className="w-6 h-6 animate-spin text-clock-blue" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-20" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path className="opacity-90" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
      </svg>
    </div>
  );
}

function Toggle({ value, onChange }: { value: boolean; onChange: () => void }) {
  return (
    <button
      onClick={onChange}
      className={`w-12 h-6 rounded-full transition-colors duration-300 relative ${value ? "bg-clock-blue" : "bg-gray-200"}`}
    >
      <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all duration-300 ${value ? "left-7" : "left-1"}`} />
    </button>
  );
}

export default function AdminPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<Tab>("payroll");

  // ── 保健師の一言 ──────────────────────────
  const [tips, setTips] = useState<Tip[]>([]);
  const [tipsLoading, setTipsLoading] = useState(false);
  const [tipsError, setTipsError] = useState("");

  // ── 従業員マスタ ──────────────────────────
  const [employees, setEmployees] = useState<EmployeeAdmin[]>([]);
  const [empLoading, setEmpLoading] = useState(false);
  const [empError, setEmpError] = useState("");

  // ── 共通モーダル ──────────────────────────
  type ModalMode = "tip-edit" | "tip-new" | "emp-edit" | "emp-new" | null;
  const [modalMode, setModalMode] = useState<ModalMode>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  // tip fields
  const [editTip, setEditTip] = useState<Tip | null>(null);
  const [editText, setEditText] = useState("");
  const [editEnabled, setEditEnabled] = useState(true);

  // employee fields
  const [editEmp, setEditEmp] = useState<EmployeeAdmin | null>(null);
  const [editName, setEditName] = useState("");
  const [editEmpId, setEditEmpId] = useState("");
  const [editStatus, setEditStatus] = useState("在職");

  // ── データ取得 ────────────────────────────
  useEffect(() => {
    if (activeTab === "tips" && tips.length === 0) {
      setTipsLoading(true);
      fetch("/api/admin/tips")
        .then((r) => r.ok ? r.json() : Promise.reject())
        .then((data: Tip[]) => setTips(data.sort((a, b) => Number(b.enabled) - Number(a.enabled))))
        .catch(() => setTipsError("取得に失敗しました"))
        .finally(() => setTipsLoading(false));
    }
    if (activeTab === "employees" && employees.length === 0) {
      setEmpLoading(true);
      fetch("/api/admin/employees")
        .then((r) => r.ok ? r.json() : Promise.reject())
        .then((data: EmployeeAdmin[]) => setEmployees(data))
        .catch(() => setEmpError("取得に失敗しました"))
        .finally(() => setEmpLoading(false));
    }
  }, [activeTab]);

  // ── 保健師の一言 操作 ─────────────────────
  const openTipEdit = (tip: Tip) => {
    setEditTip(tip); setEditText(tip.text); setEditEnabled(tip.enabled);
    setSaveError(""); setModalMode("tip-edit");
  };
  const openTipNew = () => {
    setEditTip(null); setEditText(""); setEditEnabled(true);
    setSaveError(""); setModalMode("tip-new");
  };
  const saveTip = async () => {
    setSaving(true); setSaveError("");
    try {
      if (modalMode === "tip-new") {
        const res = await fetch("/api/admin/tips", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: editText, enabled: editEnabled }),
        });
        if (!res.ok) throw new Error();
        const newTip: Tip = await res.json();
        setTips((prev) => [...prev, newTip].sort((a, b) => Number(b.enabled) - Number(a.enabled)));
      } else if (editTip) {
        const res = await fetch(`/api/admin/tips/${editTip.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: editText, enabled: editEnabled }),
        });
        if (!res.ok) throw new Error();
        setTips((prev) =>
          prev.map((t) => t.id === editTip.id ? { ...t, text: editText, enabled: editEnabled } : t)
            .sort((a, b) => Number(b.enabled) - Number(a.enabled))
        );
      }
      setModalMode(null);
    } catch { setSaveError("保存に失敗しました"); }
    finally { setSaving(false); }
  };

  // ── 従業員マスタ 操作 ─────────────────────
  const openEmpEdit = (emp: EmployeeAdmin) => {
    setEditEmp(emp); setEditName(emp.name); setEditEmpId(String(emp.employeeId ?? ""));
    setEditStatus(emp.status); setSaveError(""); setModalMode("emp-edit");
  };
  const openEmpNew = () => {
    // 既存IDから次の番号を自動生成（例: H0004 → H0005）
    const nums = employees
      .map((e) => parseInt(e.employeeId.replace(/\D/g, ""), 10))
      .filter((n) => !isNaN(n));
    const next = nums.length > 0 ? Math.max(...nums) + 1 : 1;
    const nextId = "H" + String(next).padStart(4, "0");
    setEditEmp(null); setEditName(""); setEditEmpId(nextId); setEditStatus("在職");
    setSaveError(""); setModalMode("emp-new");
  };
  const saveEmp = async () => {
    setSaving(true); setSaveError("");
    try {
      if (modalMode === "emp-new") {
        const res = await fetch("/api/admin/employees", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: editName, employeeId: editEmpId, status: editStatus }),
        });
        if (!res.ok) throw new Error();
        const newEmp: EmployeeAdmin = await res.json();
        setEmployees((prev) => [...prev, newEmp]);
      } else if (editEmp) {
        const res = await fetch(`/api/admin/employees/${editEmp.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: editName, status: editStatus }),
        });
        if (!res.ok) throw new Error();
        setEmployees((prev) =>
          prev.map((e) => e.id === editEmp.id ? { ...e, name: editName, status: editStatus } : e)
        );
      }
      setModalMode(null);
    } catch { setSaveError("保存に失敗しました"); }
    finally { setSaving(false); }
  };

  const closeModal = () => { setModalMode(null); setSaveError(""); };

  return (
    <main className="h-[100dvh] flex flex-col bg-[#f7f9fa] px-4 pt-12 pb-8">
      <div className="w-full max-w-[480px] mx-auto flex flex-col h-full">

        {/* ヘッダー */}
        <div className="relative flex items-center justify-center mb-6">
          <button
            onClick={() => router.push("/")}
            className="absolute left-0 flex items-center gap-1 text-sm text-gray-400 hover:text-gray-600 transition-colors"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 18l-6-6 6-6" />
            </svg>
            Top
          </button>
          <h1 className="text-sm font-bold text-gray-500 tracking-widest">管理者画面</h1>
        </div>

        {/* タブ */}
        <div className="flex gap-1 bg-gray-100 p-1 rounded-full shadow-inner mb-6">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 py-2.5 text-xs font-bold rounded-full transition-all duration-300 ${
                activeTab === tab.id ? "bg-white text-clock-blue shadow-md" : "text-gray-400"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* アクティブエリア */}
        <div className="flex-1 bg-white rounded-3xl shadow-[0_10px_40px_rgba(0,0,0,0.06)] overflow-hidden">

          {/* ── 給与計算用 ── */}
          {activeTab === "payroll" && <PayrollSettings />}

          {/* ── 設定 ── */}
          {activeTab === "settings" && <AppSettings />}

          {/* ── 従業員マスタ ── */}
          {activeTab === "employees" && (
            <div className="h-full flex flex-col">
              <div className="flex items-center px-6 py-3 border-b border-gray-100">
                <span className="w-16 text-xs font-bold text-gray-400 tracking-wide text-center">ID</span>
                <span className="flex-1 text-xs font-bold text-gray-400 tracking-wide px-4">名前</span>
                <span className="text-xs font-bold text-gray-400 tracking-wide w-12 text-center">状態</span>
              </div>
              <div className="flex-1 overflow-y-auto min-h-0">
                {empLoading && <Spinner />}
                {empError && <p className="text-sm text-red-400 text-center py-12">{empError}</p>}
                {!empLoading && !empError && employees.map((emp, i) => (
                  <button
                    key={emp.id}
                    onClick={() => openEmpEdit(emp)}
                    className={`w-full flex items-center px-6 py-4 text-left hover:bg-gray-50 transition-colors ${i !== employees.length - 1 ? "border-b border-gray-50" : ""}`}
                  >
                    <span className="w-16 text-sm text-gray-400 text-center">{emp.employeeId || "—"}</span>
                    <span className="flex-1 text-sm text-gray-700 px-4">{emp.name}</span>
                    <span className={`w-12 text-center text-xs font-bold px-2 py-1 rounded-full ${
                      emp.status === "退職" ? "bg-gray-100 text-gray-400" : "bg-blue-50 text-clock-blue"
                    }`}>
                      {emp.status}
                    </span>
                  </button>
                ))}
                {!empLoading && !empError && employees.length === 0 && (
                  <p className="text-sm text-gray-300 text-center py-12">データがありません</p>
                )}
              </div>
              <div className="px-6 py-4 border-t border-gray-100">
                <button
                  onClick={openEmpNew}
                  className="w-full py-3 text-sm font-bold text-clock-blue border-2 border-clock-blue/20 rounded-2xl hover:bg-clock-blue/5 transition-colors"
                >
                  ＋ 新規追加
                </button>
              </div>
            </div>
          )}

          {/* ── 保健師の一言 ── */}
          {activeTab === "tips" && (
            <div className="h-full flex flex-col">
              <div className="flex items-center px-6 py-3 border-b border-gray-100">
                <span className="flex-1 text-xs font-bold text-gray-400 tracking-wide">一言</span>
                <span className="text-xs font-bold text-gray-400 tracking-wide w-10 text-center">有効</span>
              </div>
              <div className="flex-1 overflow-y-auto min-h-0">
                {tipsLoading && <Spinner />}
                {tipsError && <p className="text-sm text-red-400 text-center py-12">{tipsError}</p>}
                {!tipsLoading && !tipsError && tips.map((tip, i) => (
                  <button
                    key={tip.id}
                    onClick={() => openTipEdit(tip)}
                    className={`w-full flex items-center px-6 py-4 text-left hover:bg-gray-50 transition-colors ${i !== tips.length - 1 ? "border-b border-gray-50" : ""}`}
                  >
                    <p className="flex-1 text-sm text-gray-700 leading-relaxed whitespace-pre-wrap pr-4">{tip.text}</p>
                    <div className="w-10 flex justify-center flex-shrink-0">
                      <span className={`w-2.5 h-2.5 rounded-full ${tip.enabled ? "bg-clock-blue" : "bg-gray-200"}`} />
                    </div>
                  </button>
                ))}
                {!tipsLoading && !tipsError && tips.length === 0 && (
                  <p className="text-sm text-gray-300 text-center py-12">データがありません</p>
                )}
              </div>
              <div className="px-6 py-4 border-t border-gray-100">
                <button
                  onClick={openTipNew}
                  className="w-full py-3 text-sm font-bold text-clock-blue border-2 border-clock-blue/20 rounded-2xl hover:bg-clock-blue/5 transition-colors"
                >
                  ＋ 新規追加
                </button>
              </div>
            </div>
          )}

        </div>
      </div>

      {/* ── モーダル ── */}
      {modalMode && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="fixed inset-0 bg-black/40 flex items-center justify-center px-8 z-50"
          onClick={closeModal}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.2 }}
            className="bg-white rounded-3xl px-6 py-6 w-full max-w-[360px] shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* 保健師の一言モーダル */}
            {(modalMode === "tip-edit" || modalMode === "tip-new") && (
              <>
                <p className="text-xs font-bold text-gray-400 tracking-wide mb-4">
                  {modalMode === "tip-new" ? "一言を追加" : "一言を編集"}
                </p>
                <textarea
                  value={editText}
                  onChange={(e) => setEditText(e.target.value)}
                  rows={4}
                  className="w-full px-4 py-3 text-sm rounded-2xl border-2 border-gray-100 bg-gray-50 focus:outline-none focus:border-clock-blue/50 transition-colors resize-none mb-4"
                />
                <div className="flex items-center justify-between mb-6">
                  <span className="text-sm text-gray-500">有効</span>
                  <Toggle value={editEnabled} onChange={() => setEditEnabled((v) => !v)} />
                </div>
                {saveError && <p className="text-xs text-red-400 text-center mb-3">{saveError}</p>}
                <div className="flex gap-2">
                  <button onClick={closeModal} className="flex-1 py-3 text-sm font-bold text-gray-400 border border-gray-200 rounded-2xl">キャンセル</button>
                  <button onClick={saveTip} disabled={saving || !editText.trim()} className="flex-1 py-3 text-sm font-bold text-white bg-clock-blue rounded-2xl disabled:opacity-50">
                    {saving ? "保存中..." : "保存"}
                  </button>
                </div>
              </>
            )}

            {/* 従業員モーダル */}
            {(modalMode === "emp-edit" || modalMode === "emp-new") && (
              <>
                <p className="text-xs font-bold text-gray-400 tracking-wide mb-4">
                  {modalMode === "emp-new" ? "従業員を追加" : "従業員を編集"}
                </p>
                {modalMode === "emp-new" && (
                  <div className="mb-3">
                    <label className="block text-xs text-gray-400 mb-1">従業員ID</label>
                    <input
                      type="text"
                      value={editEmpId}
                      onChange={(e) => setEditEmpId(e.target.value)}
                      className="w-full px-4 py-3 text-sm rounded-2xl border-2 border-gray-100 bg-gray-50 focus:outline-none focus:border-clock-blue/50 transition-colors"
                    />
                  </div>
                )}
                <div className="mb-4">
                  <label className="block text-xs text-gray-400 mb-1">名前</label>
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="w-full px-4 py-3 text-sm rounded-2xl border-2 border-gray-100 bg-gray-50 focus:outline-none focus:border-clock-blue/50 transition-colors"
                  />
                </div>
                <div className="flex items-center justify-between mb-6">
                  <span className="text-sm text-gray-500">在職中</span>
                  <Toggle value={editStatus !== "退職"} onChange={() => setEditStatus((s) => s === "退職" ? "在職" : "退職")} />
                </div>
                {saveError && <p className="text-xs text-red-400 text-center mb-3">{saveError}</p>}
                <div className="flex gap-2">
                  <button onClick={closeModal} className="flex-1 py-3 text-sm font-bold text-gray-400 border border-gray-200 rounded-2xl">キャンセル</button>
                  <button onClick={saveEmp} disabled={saving || !editName.trim()} className="flex-1 py-3 text-sm font-bold text-white bg-clock-blue rounded-2xl disabled:opacity-50">
                    {saving ? "保存中..." : "保存"}
                  </button>
                </div>
              </>
            )}
          </motion.div>
        </motion.div>
      )}
    </main>
  );
}
