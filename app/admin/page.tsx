"use client";

import { useEffect, useState } from "react";
import { adminFetch } from "@/lib/adminFetch";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import PayrollSettings from "@/components/PayrollSettings";
import CareerSettings from "@/components/CareerSettings";
import MonthlySummary from "@/components/MonthlySummary";
import HolidaySettings from "@/components/HolidaySettings";
import OvertimeRequests from "@/components/OvertimeRequests";
import DebugSettings from "@/components/DebugSettings";

type Tab = "monthly" | "holiday" | "overtime" | "career" | "payroll" | "employees" | "tips" | "debug";

type Tip = {
  id: string;
  text: string;
  enabled: boolean;
};

type EmployeeAdmin = {
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
  name: string;
  store: string;
  rank: string;
  nominationFee: string;
  careerTarget: string;
  joinType: string;
  joinDate: string;
  careerUpdateDate: string;
  careerInterviewDate: string;
};

const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  {
    id: "monthly",
    label: "月次集計",
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="4" width="18" height="18" rx="2" />
        <path d="M16 2v4M8 2v4M3 10h18" />
        <path d="M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01M16 18h.01" />
      </svg>
    ),
  },
  {
    id: "holiday",
    label: "公休設定",
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="4" width="18" height="18" rx="2" />
        <path d="M16 2v4M8 2v4M3 10h18" />
        <path d="M8 14h.01M12 14h.01M8 18h.01M12 18h.01" />
      </svg>
    ),
  },
  {
    id: "overtime",
    label: "申請対応",
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 12l2 2 4-4" />
        <path d="M21 12c0 4.97-4.03 9-9 9s-9-4.03-9-9 4.03-9 9-9c2.39 0 4.68.94 6.36 2.64" />
      </svg>
    ),
  },
  {
    id: "career",
    label: "キャリア支援",
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
      </svg>
    ),
  },
  {
    id: "payroll",
    label: "店舗別設定",
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12.22 2h-.44a2 2 0 00-2 2v.18a2 2 0 01-1 1.73l-.43.25a2 2 0 01-2 0l-.15-.08a2 2 0 00-2.73.73l-.22.38a2 2 0 00.73 2.73l.15.1a2 2 0 011 1.72v.51a2 2 0 01-1 1.74l-.15.09a2 2 0 00-.73 2.73l.22.38a2 2 0 002.73.73l.15-.08a2 2 0 012 0l.43.25a2 2 0 011 1.73V20a2 2 0 002 2h.44a2 2 0 002-2v-.18a2 2 0 011-1.73l.43-.25a2 2 0 012 0l.15.08a2 2 0 002.73-.73l.22-.39a2 2 0 00-.73-2.73l-.15-.08a2 2 0 01-1-1.74v-.5a2 2 0 011-1.74l.15-.09a2 2 0 00.73-2.73l-.22-.38a2 2 0 00-2.73-.73l-.15.08a2 2 0 01-2 0l-.43-.25a2 2 0 01-1-1.73V4a2 2 0 00-2-2z" />
        <circle cx="12" cy="12" r="3" />
      </svg>
    ),
  },
  {
    id: "employees",
    label: "従業員マスタ",
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" />
      </svg>
    ),
  },
  {
    id: "tips",
    label: "保健師の一言",
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
      </svg>
    ),
  },
];

function Spinner() {
  return (
    <div className="h-full w-full flex flex-col items-center justify-center gap-3 py-20">
      <svg className="w-7 h-7 animate-spin text-clock-blue" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-20" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path className="opacity-90" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
      </svg>
      <p className="text-[10px] font-bold text-gray-400 tracking-[0.2em]">NOTION 連携中</p>
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
  const [activeTab, setActiveTab] = useState<Tab>("monthly");

  // ── 認証 ─────────────────────────────────
  const [authChecked, setAuthChecked] = useState(false);
  const [authenticated, setAuthenticated] = useState(false);
  const [loginPassword, setLoginPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [loginSubmitting, setLoginSubmitting] = useState(false);

  // ── 申請対応の未対応件数（左メニューバッジ用） ──
  const [pendingOvertimeCount, setPendingOvertimeCount] = useState<number | null>(null);
  const refreshPendingOvertime = () => {
    adminFetch("/api/admin/overtime-requests?status=未対応")
      .then((r) => r.ok ? r.json() : Promise.reject(new Error()))
      .then((data: unknown[]) => setPendingOvertimeCount(Array.isArray(data) ? data.length : 0))
      .catch(() => {});
  };

  useEffect(() => {
    fetch("/api/admin/auth/check")
      .then((r) => {
        if (r.ok) {
          setAuthenticated(true);
          refreshPendingOvertime();
        }
      })
      .catch(() => {})
      .finally(() => setAuthChecked(true));
  }, []);

  // タブ切替時に未対応件数を再取得（別端末からの新規申請を反映）
  useEffect(() => {
    if (authenticated) refreshPendingOvertime();
  }, [activeTab, authenticated]);

  const handleLogin = async () => {
    setLoginSubmitting(true);
    setLoginError("");
    try {
      const res = await fetch("/api/admin/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: loginPassword }),
      });
      if (res.ok) {
        setAuthenticated(true);
        setLoginPassword("");
      } else {
        setLoginError("パスワードが違います");
      }
    } catch {
      setLoginError("通信エラーが発生しました");
    } finally {
      setLoginSubmitting(false);
    }
  };

  // ── 保健師の一言 ──────────────────────────
  const [tips, setTips] = useState<Tip[]>([]);
  const [tipsLoading, setTipsLoading] = useState(false);
  const [tipsError, setTipsError] = useState("");

  // ── 従業員マスタ ──────────────────────────
  const [employees, setEmployees] = useState<EmployeeAdmin[]>([]);
  const [empLoading, setEmpLoading] = useState(true);
  const [empError, setEmpError] = useState("");
  const [selectedEmpStore, setSelectedEmpStore] = useState<string>("");
  const [empSubTab, setEmpSubTab] = useState<"basic" | "career">("basic");
  const [storeList, setStoreList] = useState<string[]>([]);
  const [empOptions, setEmpOptions] = useState<{ jobTitles: string[]; contractTypes: string[]; statuses: string[] }>({ jobTitles: [], contractTypes: [], statuses: [] });

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
  const [editIdentifier, setEditIdentifier] = useState("");
  const [editEmployeeNumber, setEditEmployeeNumber] = useState("");
  const [editLastName, setEditLastName] = useState("");
  const [editFirstName, setEditFirstName] = useState("");
  const [editStoreName, setEditStoreName] = useState("");
  const [editDepartment, setEditDepartment] = useState("");
  const [editJobTitle, setEditJobTitle] = useState("");
  const [editContractType, setEditContractType] = useState("");
  const [editStatus, setEditStatus] = useState("在職");

  // ── データ取得 ────────────────────────────
  useEffect(() => {
    if (activeTab === "tips" && tips.length === 0) {
      setTipsLoading(true);
      adminFetch("/api/admin/tips")
        .then((r) => r.ok ? r.json() : Promise.reject())
        .then((data: Tip[]) => setTips(data.sort((a, b) => Number(b.enabled) - Number(a.enabled))))
        .catch(() => setTipsError("取得に失敗しました"))
        .finally(() => setTipsLoading(false));
    }
    if (activeTab === "employees" && employees.length === 0) {
      setEmpLoading(true);
      Promise.all([
        adminFetch("/api/admin/employees").then((r) => r.ok ? r.json() : Promise.reject()),
        adminFetch("/api/admin/store-settings").then((r) => r.ok ? r.json() : Promise.reject()),
        adminFetch("/api/admin/employees/options").then((r) => r.ok ? r.json() : Promise.reject()),
      ])
        .then(([empData, storeData, optData]: [EmployeeAdmin[], { storeName: string }[], any]) => {
          setEmployees(empData);
          setStoreList(storeData.map((s) => s.storeName).filter(Boolean).sort((a, b) => b.localeCompare(a)));
          setEmpOptions({ jobTitles: optData.jobTitles ?? [], contractTypes: optData.contractTypes ?? [], statuses: optData.statuses ?? [] });
        })
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
        const res = await adminFetch("/api/admin/tips", {
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
    setEditEmp(emp);
    setEditIdentifier(emp.identifier);
    setEditEmployeeNumber(emp.employeeNumber);
    setEditLastName(emp.lastName);
    setEditFirstName(emp.firstName);
    setEditStoreName(emp.storeName);
    setEditDepartment(emp.department);
    setEditJobTitle(emp.jobTitle);
    setEditContractType(emp.contractType);
    setEditStatus(emp.status);
    setSaveError(""); setModalMode("emp-edit");
  };
  const openEmpNew = () => {
    const nums = employees
      .map((e) => parseInt(e.employeeNumber.replace(/\D/g, ""), 10))
      .filter((n) => !isNaN(n));
    const next = nums.length > 0 ? Math.max(...nums) + 1 : 1;
    setEditEmp(null);
    setEditIdentifier("");
    setEditEmployeeNumber(String(next).padStart(4, "0"));
    setEditLastName("");
    setEditFirstName("");
    setEditStoreName("株式会社ROMMY.");
    setEditDepartment("");
    setEditJobTitle("");
    setEditContractType("");
    setEditStatus("在職");
    setSaveError(""); setModalMode("emp-new");
  };
  const saveEmp = async () => {
    setSaving(true); setSaveError("");
    const payload = {
      identifier: editIdentifier,
      employeeNumber: editEmployeeNumber,
      lastName: editLastName,
      firstName: editFirstName,
      storeName: editStoreName,
      department: editDepartment,
      jobTitle: editJobTitle,
      contractType: editContractType,
      status: editStatus,
    };
    try {
      if (modalMode === "emp-new") {
        const res = await adminFetch("/api/admin/employees", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) throw new Error();
        const newEmp: EmployeeAdmin = await res.json();
        setEmployees((prev) => [...prev, newEmp]);
      } else if (editEmp) {
        const res = await adminFetch(`/api/admin/employees/${editEmp.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) throw new Error();
        setEmployees((prev) =>
          prev.map((e) => e.id === editEmp.id
            ? { ...e, ...payload, name: `${editLastName} ${editFirstName}`, store: editDepartment }
            : e)
        );
      }
      setModalMode(null);
    } catch { setSaveError("保存に失敗しました"); }
    finally { setSaving(false); }
  };

  const closeModal = () => { setModalMode(null); setSaveError(""); };

  // ── タブコンテンツ ────────────────────────
  const tabContent = (
    <>
      {activeTab === "monthly" && <MonthlySummary />}
      {activeTab === "holiday" && <HolidaySettings />}
      {activeTab === "overtime" && <OvertimeRequests onActionDone={refreshPendingOvertime} />}
      {activeTab === "career" && <CareerSettings />}
      {activeTab === "payroll" && <PayrollSettings />}
      {activeTab === "debug" && <DebugSettings />}

      {activeTab === "employees" && empLoading && (
        <div className="h-full flex flex-col items-center justify-center gap-3">
          <svg className="w-7 h-7 animate-spin text-clock-blue" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-20" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-90" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
          </svg>
          <p className="text-[10px] font-bold text-gray-400 tracking-[0.2em]">NOTION 連携中</p>
        </div>
      )}

      {activeTab === "employees" && !empLoading && (
        <div className="h-full flex flex-col">
          {/* 部門フィルター + サブタブ */}
          <div className="px-6 py-4 border-b border-gray-100 shrink-0 flex items-center gap-3">
            <div className="relative inline-block">
              <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
                </svg>
              </span>
              <select
                value={selectedEmpStore}
                onChange={(e) => setSelectedEmpStore(e.target.value)}
                className="appearance-none pl-8 pr-7 py-1.5 text-sm font-bold text-white bg-gray-600 rounded-full focus:outline-none focus:ring-2 focus:ring-gray-400/40 cursor-pointer"
              >
                <option value="">全員</option>
                {storeList.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
              <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-white/70">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                  <path d="M6 9l6 6 6-6" />
                </svg>
              </span>
            </div>
            <div className="ml-auto flex items-center gap-1 bg-gray-100 p-1 rounded-full shadow-inner">
              <button
                onClick={() => setEmpSubTab("basic")}
                className={`px-4 py-1 text-xs font-bold rounded-full transition-all ${
                  empSubTab === "basic" ? "bg-white text-clock-blue shadow-sm" : "text-gray-400"
                }`}
              >
                基本情報
              </button>
              <button
                onClick={() => setEmpSubTab("career")}
                className={`px-4 py-1 text-xs font-bold rounded-full transition-all ${
                  empSubTab === "career" ? "bg-white text-clock-blue shadow-sm" : "text-gray-400"
                }`}
              >
                キャリア情報
              </button>
            </div>
          </div>
          <div className="flex-1 overflow-auto min-h-0">
            {/* テーブルヘッダー（sticky） */}
            <div className="sticky top-0 z-10 bg-white border-b border-gray-100">
              <div className="flex items-center px-4 py-3 min-w-max">
                {empSubTab === "basic" ? (
                  <>
                    <span className="w-28 text-xs font-bold text-gray-400 tracking-wide shrink-0 overflow-hidden">従業員識別子</span>
                    <span className="w-px bg-gray-100 mx-2 self-stretch shrink-0" />
                    <span className="w-16 text-xs font-bold text-gray-400 tracking-wide shrink-0 text-center">従業員番号</span>
                    <span className="w-px bg-gray-100 mx-2 self-stretch shrink-0" />
                    <span className="w-16 text-xs font-bold text-gray-400 tracking-wide shrink-0 pl-2">姓</span>
                    <span className="w-px bg-gray-100 mx-2 self-stretch shrink-0" />
                    <span className="w-16 text-xs font-bold text-gray-400 tracking-wide shrink-0">名</span>
                    <span className="w-px bg-gray-100 mx-2 self-stretch shrink-0" />
                    <span className="w-32 text-xs font-bold text-gray-400 tracking-wide shrink-0">事業所名</span>
                    <span className="w-px bg-gray-100 mx-2 self-stretch shrink-0" />
                    <span className="w-24 text-xs font-bold text-gray-400 tracking-wide shrink-0">部門名</span>
                    <span className="w-px bg-gray-100 mx-2 self-stretch shrink-0" />
                    <span className="w-24 text-xs font-bold text-gray-400 tracking-wide shrink-0">職種名</span>
                    <span className="w-px bg-gray-100 mx-2 self-stretch shrink-0" />
                    <span className="w-20 text-xs font-bold text-gray-400 tracking-wide shrink-0">契約種別</span>
                    <span className="w-px bg-gray-100 mx-2 self-stretch shrink-0" />
                    <span className="w-14 text-xs font-bold text-gray-400 tracking-wide shrink-0 text-center">状態</span>
                  </>
                ) : (
                  <>
                    <span className="w-16 text-xs font-bold text-gray-400 tracking-wide shrink-0 text-center">番号</span>
                    <span className="w-px bg-gray-100 mx-2 self-stretch shrink-0" />
                    <span className="w-16 text-xs font-bold text-gray-400 tracking-wide shrink-0 pl-2">姓</span>
                    <span className="w-px bg-gray-100 mx-2 self-stretch shrink-0" />
                    <span className="w-16 text-xs font-bold text-gray-400 tracking-wide shrink-0">名</span>
                    <span className="w-px bg-gray-200 mx-3 self-stretch shrink-0" />
                    <span className="w-40 text-xs font-bold text-gray-400 tracking-wide shrink-0">ランク</span>
                    <span className="w-px bg-gray-100 mx-2 self-stretch shrink-0" />
                    <span className="w-16 text-xs font-bold text-gray-400 tracking-wide shrink-0 text-center">指名料</span>
                    <span className="w-px bg-gray-100 mx-2 self-stretch shrink-0" />
                    <span className="w-20 text-xs font-bold text-gray-400 tracking-wide shrink-0">対象</span>
                    <span className="w-px bg-gray-100 mx-2 self-stretch shrink-0" />
                    <span className="w-16 text-xs font-bold text-gray-400 tracking-wide shrink-0">種別</span>
                    <span className="w-px bg-gray-100 mx-2 self-stretch shrink-0" />
                    <span className="w-24 text-xs font-bold text-gray-400 tracking-wide shrink-0">入社時期</span>
                    <span className="w-px bg-gray-100 mx-2 self-stretch shrink-0" />
                    <span className="w-28 text-xs font-bold text-gray-400 tracking-wide shrink-0">更新時期</span>
                    <span className="w-px bg-gray-100 mx-2 self-stretch shrink-0" />
                    <span className="w-28 text-xs font-bold text-gray-400 tracking-wide shrink-0">面談時期</span>
                  </>
                )}
              </div>
            </div>
            {empLoading && <Spinner />}
            {empError && <p className="text-sm text-red-400 text-center py-12">{empError}</p>}
            {!empLoading && !empError && employees.filter((e) => !selectedEmpStore || e.department === selectedEmpStore).map((emp, i, arr) => (
              <button
                key={emp.id}
                onClick={() => openEmpEdit(emp)}
                className={`w-full flex items-center px-4 py-3.5 text-left hover:bg-gray-50 transition-colors min-w-max ${i !== arr.length - 1 ? "border-b border-gray-50" : ""}`}
              >
                {empSubTab === "basic" ? (
                  <>
                    <span className="w-28 text-sm text-gray-600 shrink-0 truncate whitespace-nowrap overflow-hidden">{emp.identifier || "—"}</span>
                    <span className="w-px bg-gray-100 mx-2 self-stretch shrink-0" />
                    <span className="w-16 text-sm text-gray-400 shrink-0 text-center">{emp.employeeNumber || "—"}</span>
                    <span className="w-px bg-gray-100 mx-2 self-stretch shrink-0" />
                    <span className="w-16 text-sm text-gray-700 shrink-0 pl-2">{emp.lastName || "—"}</span>
                    <span className="w-px bg-gray-100 mx-2 self-stretch shrink-0" />
                    <span className="w-16 text-sm text-gray-700 shrink-0">{emp.firstName || "—"}</span>
                    <span className="w-px bg-gray-100 mx-2 self-stretch shrink-0" />
                    <span className="w-32 text-sm text-gray-500 shrink-0 truncate pr-2">{emp.storeName || "—"}</span>
                    <span className="w-px bg-gray-100 mx-2 self-stretch shrink-0" />
                    <span className="w-24 text-sm text-gray-500 shrink-0">{emp.department || "—"}</span>
                    <span className="w-px bg-gray-100 mx-2 self-stretch shrink-0" />
                    <span className="w-24 text-sm text-gray-500 shrink-0">{emp.jobTitle || "—"}</span>
                    <span className="w-px bg-gray-100 mx-2 self-stretch shrink-0" />
                    <span className="w-20 text-sm text-gray-500 shrink-0">{emp.contractType || "—"}</span>
                    <span className="w-px bg-gray-100 mx-2 self-stretch shrink-0" />
                    <span className={`w-14 text-center text-xs font-bold px-2 py-1 rounded-full shrink-0 ${
                      emp.status === "退職" ? "bg-gray-100 text-gray-400"
                      : emp.status === "休職" ? "bg-amber-50 text-amber-500"
                      : "bg-blue-50 text-clock-blue"
                    }`}>
                      {emp.status}
                    </span>
                  </>
                ) : (
                  <>
                    <span className="w-16 text-sm text-gray-400 shrink-0 text-center">{emp.employeeNumber || "—"}</span>
                    <span className="w-px bg-gray-100 mx-2 self-stretch shrink-0" />
                    <span className="w-16 text-sm text-gray-700 shrink-0 pl-2">{emp.lastName || "—"}</span>
                    <span className="w-px bg-gray-100 mx-2 self-stretch shrink-0" />
                    <span className="w-16 text-sm text-gray-700 shrink-0">{emp.firstName || "—"}</span>
                    <span className="w-px bg-gray-200 mx-3 self-stretch shrink-0" />
                    <span className="w-40 text-sm text-gray-500 shrink-0 truncate">{emp.rank || "—"}</span>
                    <span className="w-px bg-gray-100 mx-2 self-stretch shrink-0" />
                    <span className="w-16 text-sm text-gray-500 shrink-0 text-center">{emp.nominationFee || "—"}</span>
                    <span className="w-px bg-gray-100 mx-2 self-stretch shrink-0" />
                    <span className="w-20 text-sm text-gray-500 shrink-0">{emp.careerTarget || "—"}</span>
                    <span className="w-px bg-gray-100 mx-2 self-stretch shrink-0" />
                    <span className="w-16 text-sm text-gray-500 shrink-0">{emp.joinType || "—"}</span>
                    <span className="w-px bg-gray-100 mx-2 self-stretch shrink-0" />
                    <span className="w-24 text-sm text-gray-500 shrink-0">{emp.joinDate || "—"}</span>
                    <span className="w-px bg-gray-100 mx-2 self-stretch shrink-0" />
                    <span className="w-28 text-sm text-gray-500 shrink-0">{emp.careerUpdateDate || "—"}</span>
                    <span className="w-px bg-gray-100 mx-2 self-stretch shrink-0" />
                    <span className="w-28 text-sm text-gray-500 shrink-0">{emp.careerInterviewDate || "—"}</span>
                  </>
                )}
              </button>
            ))}
            {!empLoading && !empError && employees.filter((e) => !selectedEmpStore || e.department === selectedEmpStore).length === 0 && (
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
    </>
  );

  // 認証チェック中
  if (!authChecked) {
    return (
      <main className="h-[100dvh] flex items-center justify-center bg-[#f7f9fa]">
        <div className="flex flex-col items-center gap-3">
          <svg className="w-7 h-7 animate-spin text-clock-blue" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-20" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-90" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
          </svg>
        </div>
      </main>
    );
  }

  // 未認証：ログインモーダル
  if (!authenticated) {
    return (
      <main className="h-[100dvh] flex items-center justify-center bg-[#f7f9fa] px-4">
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.2 }}
          className="bg-white rounded-3xl px-6 py-6 w-full max-w-[360px] shadow-xl"
        >
          <p className="text-[10px] font-bold text-gray-300 tracking-[0.25em] uppercase mb-1 text-center">Admin</p>
          <p className="text-base font-extrabold text-gray-700 text-center mb-5">管理者ログイン</p>
          <input
            type="password"
            value={loginPassword}
            onChange={(e) => setLoginPassword(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") handleLogin(); }}
            placeholder="パスワード"
            autoFocus
            className="w-full px-4 py-3 text-sm rounded-2xl border-2 border-gray-100 bg-slate-50 focus:outline-none focus:border-clock-blue/50 transition-colors mb-3"
          />
          {loginError && <p className="text-xs text-red-400 text-center mb-3">{loginError}</p>}
          <button
            onClick={handleLogin}
            disabled={loginSubmitting || !loginPassword}
            className="w-full py-3 text-sm font-bold text-white bg-clock-blue rounded-2xl disabled:opacity-50 hover:bg-clock-blue/90 transition-colors"
          >
            {loginSubmitting ? "確認中..." : "ログイン"}
          </button>
          <button
            onClick={() => router.push("/")}
            className="w-full mt-3 py-2 text-xs font-bold text-gray-400 hover:text-gray-600 transition-colors"
          >
            ← トップに戻る
          </button>
        </motion.div>
      </main>
    );
  }

  return (
    <main className="h-[100dvh] flex bg-[#f7f9fa] overflow-hidden">

      {/* ── サイドバー（md以上） ───────────────── */}
      <aside className="hidden md:flex flex-col w-56 bg-white border-r border-gray-100 shrink-0">
        {/* ロゴ */}
        <div className="px-6 pt-8 pb-6 border-b border-gray-100">
          <p className="text-[10px] font-bold text-gray-300 tracking-widest uppercase mb-0.5">Admin</p>
          <p className="text-xl font-extrabold text-gray-700">Tap-IN</p>
        </div>

        {/* ナビゲーション */}
        <nav className="flex-1 px-3 py-4 space-y-0.5">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-bold transition-all duration-200 ${
                activeTab === tab.id
                  ? "bg-clock-blue/10 text-clock-blue"
                  : "text-gray-400 hover:bg-gray-50 hover:text-gray-600"
              }`}
            >
              <span className={`shrink-0 transition-colors ${activeTab === tab.id ? "text-clock-blue" : "text-gray-300"}`}>
                {tab.icon}
              </span>
              <span className="flex-1 text-left">{tab.label}</span>
              {tab.id === "overtime" && pendingOvertimeCount != null && pendingOvertimeCount > 0 && (
                <span className="shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full bg-clock-blue text-white tabular-nums">
                  {pendingOvertimeCount}
                </span>
              )}
            </button>
          ))}
        </nav>

        {/* デバッグ＋Top に戻る */}
        <div className="px-3 pb-8 border-t border-gray-100 pt-4 space-y-0.5">
          <button
            onClick={() => setActiveTab("debug")}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-bold transition-all duration-200 ${
              activeTab === "debug"
                ? "bg-clock-blue/10 text-clock-blue"
                : "text-gray-400 hover:bg-gray-50 hover:text-gray-600"
            }`}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`shrink-0 transition-colors ${activeTab === "debug" ? "text-clock-blue" : "text-gray-300"}`}>
              <path d="M12 22C6.477 22 2 17.523 2 12S6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z" />
              <path d="M12 8v4M12 16h.01" />
            </svg>
            デバッグ
          </button>
          <button
            onClick={() => router.push("/")}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-bold text-gray-400 hover:bg-gray-50 hover:text-gray-600 transition-all duration-200"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 18l-6-6 6-6" />
            </svg>
            Top に戻る
          </button>
        </div>
      </aside>

      {/* ── 右エリア ────────────────────────── */}
      <div className="flex-1 flex flex-col overflow-hidden">

        {/* モバイル：ヘッダー */}
        <div className="md:hidden relative flex items-center justify-center px-4 pt-12 mb-0 max-w-[480px] mx-auto w-full">
          <button
            onClick={() => router.push("/")}
            className="absolute left-4 flex items-center gap-1 text-sm text-gray-400 hover:text-gray-600 transition-colors"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 18l-6-6 6-6" />
            </svg>
            Top
          </button>
          <h1 className="text-sm font-bold text-gray-500 tracking-widest">管理者画面</h1>
        </div>

        {/* モバイル：タブバー */}
        <div className="md:hidden px-4 pt-4 max-w-[480px] mx-auto w-full">
          <div className="flex gap-1 bg-gray-100 p-1 rounded-full shadow-inner">
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
        </div>

        {/* コンテンツカード */}
        <div className="flex-1 min-h-0 px-4 pt-4 pb-8 md:px-8 md:pt-8 max-w-[480px] md:max-w-none mx-auto w-full">
          <div className="h-full bg-white rounded-3xl shadow-[0_10px_40px_rgba(0,0,0,0.06)] overflow-hidden">
            {tabContent}
          </div>
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
                  className="w-full px-4 py-3 text-sm rounded-2xl border-2 border-gray-100 bg-slate-50 focus:outline-none focus:border-clock-blue/50 transition-colors resize-none mb-4"
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
                <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">従業員識別子</label>
                    <input type="text" value={editIdentifier} onChange={(e) => setEditIdentifier(e.target.value)}
                      className="w-full px-4 py-3 text-sm rounded-2xl border-2 border-gray-100 bg-slate-50 focus:outline-none focus:border-clock-blue/50 transition-colors" />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">従業員番号</label>
                    <input type="text" value={editEmployeeNumber} onChange={(e) => setEditEmployeeNumber(e.target.value)}
                      className="w-full px-4 py-3 text-sm rounded-2xl border-2 border-gray-100 bg-slate-50 focus:outline-none focus:border-clock-blue/50 transition-colors" />
                  </div>
                  <div className="flex gap-3">
                    <div className="flex-1">
                      <label className="block text-xs text-gray-400 mb-1">姓</label>
                      <input type="text" value={editLastName} onChange={(e) => setEditLastName(e.target.value)}
                        className="w-full px-4 py-3 text-sm rounded-2xl border-2 border-gray-100 bg-slate-50 focus:outline-none focus:border-clock-blue/50 transition-colors" />
                    </div>
                    <div className="flex-1">
                      <label className="block text-xs text-gray-400 mb-1">名</label>
                      <input type="text" value={editFirstName} onChange={(e) => setEditFirstName(e.target.value)}
                        className="w-full px-4 py-3 text-sm rounded-2xl border-2 border-gray-100 bg-slate-50 focus:outline-none focus:border-clock-blue/50 transition-colors" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">事業所名</label>
                    <select value={editStoreName} onChange={(e) => setEditStoreName(e.target.value)}
                      className="w-full px-4 py-3 text-sm rounded-2xl border-2 border-gray-100 bg-slate-50 focus:outline-none focus:border-clock-blue/50 transition-colors appearance-none">
                      <option value="">選択してください</option>
                      {["株式会社ROMMY."].map((o) => <option key={o} value={o}>{o}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">部門名</label>
                    <select value={editDepartment} onChange={(e) => setEditDepartment(e.target.value)}
                      className="w-full px-4 py-3 text-sm rounded-2xl border-2 border-gray-100 bg-slate-50 focus:outline-none focus:border-clock-blue/50 transition-colors appearance-none">
                      <option value="">選択してください</option>
                      {storeList.map((o) => <option key={o} value={o}>{o}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">職種名</label>
                    <select value={editJobTitle} onChange={(e) => setEditJobTitle(e.target.value)}
                      className="w-full px-4 py-3 text-sm rounded-2xl border-2 border-gray-100 bg-slate-50 focus:outline-none focus:border-clock-blue/50 transition-colors appearance-none">
                      <option value="">選択してください</option>
                      {empOptions.jobTitles.map((o) => <option key={o} value={o}>{o}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">契約種別</label>
                    <select value={editContractType} onChange={(e) => setEditContractType(e.target.value)}
                      className="w-full px-4 py-3 text-sm rounded-2xl border-2 border-gray-100 bg-slate-50 focus:outline-none focus:border-clock-blue/50 transition-colors appearance-none">
                      <option value="">選択してください</option>
                      {empOptions.contractTypes.map((o) => <option key={o} value={o}>{o}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">ステータス</label>
                    <select value={editStatus} onChange={(e) => setEditStatus(e.target.value)}
                      className="w-full px-4 py-3 text-sm rounded-2xl border-2 border-gray-100 bg-slate-50 focus:outline-none focus:border-clock-blue/50 transition-colors appearance-none">
                      {empOptions.statuses.map((o) => <option key={o} value={o}>{o}</option>)}
                    </select>
                  </div>
                </div>
                {saveError && <p className="text-xs text-red-400 text-center mt-3 mb-1">{saveError}</p>}
                <div className="flex gap-2 mt-5">
                  <button onClick={closeModal} className="flex-1 py-3 text-sm font-bold text-gray-400 border border-gray-200 rounded-2xl">キャンセル</button>
                  <button onClick={saveEmp} disabled={saving || !editIdentifier.trim() || !editLastName.trim()} className="flex-1 py-3 text-sm font-bold text-white bg-clock-blue rounded-2xl disabled:opacity-50">
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
