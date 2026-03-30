"use client";

import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import type { Employee } from "@/lib/notion";

type StampType = "出勤" | "退勤";

type Props = {
  employees: Employee[];
  onSuccess: (name: string, type: StampType, time: Date) => void;
};

export default function InputForm({ employees, onSuccess }: Props) {
  const [selectedId, setSelectedId] = useState("");
  const [selectedName, setSelectedName] = useState("");
  const [mode, setMode] = useState<StampType>("出勤");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  // 前回のIDをlocalStorageから復元
  useEffect(() => {
    const saved = localStorage.getItem("saved_employee_id");
    if (saved) {
      const found = employees.find((e) => e.id === saved);
      if (found) {
        setSelectedId(found.id);
        setSelectedName(found.name);
      }
    }
  }, [employees]);

  const handleSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const id = e.target.value;
    const emp = employees.find((x) => x.id === id);
    setSelectedId(id);
    setSelectedName(emp?.name ?? "");
  };

  const handleSubmit = async () => {
    if (!selectedId || submitting) return;
    setSubmitting(true);
    setError("");
    localStorage.setItem("saved_employee_id", selectedId);

    try {
      const res = await fetch("/api/timestamp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pageId: selectedId,
          employeeName: selectedName,
          type: mode,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        const msg = data.detail
          ? `${data.error}（${data.detail}）`
          : data.error ?? "エラーが発生しました";
        throw new Error(msg);
      }
      onSuccess(selectedName, mode, new Date());
    } catch (err: any) {
      setError(err.message ?? "エラーが発生しました");
      setSubmitting(false);
    }
  };

  const isReady = !!selectedId && !submitting;
  const btnColor = mode === "出勤" ? "bg-clock-blue" : "bg-clock-red";

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.07 },
    },
  };
  const itemVariants = {
    hidden: { opacity: 0, y: 12 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.35 } },
  };

  return (
    <motion.div
      key="input"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      exit={{ opacity: 0, y: -16 }}
      className="text-left"
    >
      {/* 名前選択 */}
      <motion.div variants={itemVariants}>
        <span className="block text-xs text-gray-500 font-semibold tracking-wide mb-2">
          名前を選択
        </span>
        <div className="relative mb-6">
          <select
            value={selectedId}
            onChange={handleSelect}
            className="w-full px-4 py-4 text-base rounded-2xl border-2 border-gray-100 bg-gray-50 appearance-none focus:outline-none focus:border-clock-blue/50 transition-colors"
          >
            <option value="" disabled>
              名前を選んでください
            </option>
            {employees.map((emp) => (
              <option key={emp.id} value={emp.id}>
                {emp.name}
              </option>
            ))}
          </select>
          {/* chevron */}
          <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-clock-blue">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
              <path d="M7 10l5 5 5-5H7z" />
            </svg>
          </span>
        </div>
      </motion.div>

      {/* 種別選択 */}
      <motion.div variants={itemVariants}>
        <span className="block text-xs text-gray-500 font-semibold tracking-wide mb-2">
          種別を選択
        </span>
        <div className="flex gap-1 bg-gray-100 p-1 rounded-full mb-7 shadow-inner">
          {(["出勤", "退勤"] as StampType[]).map((t) => (
            <button
              key={t}
              onClick={() => setMode(t)}
              className={`flex-1 py-4 text-base font-bold rounded-full transition-all duration-300 ${
                mode === t
                  ? t === "出勤"
                    ? "bg-white text-clock-blue shadow-md scale-[1.02]"
                    : "bg-white text-clock-red shadow-md scale-[1.02]"
                  : "text-gray-400"
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </motion.div>

      {/* 打刻ボタン */}
      <motion.div variants={itemVariants}>
        <motion.button
          onClick={handleSubmit}
          disabled={!isReady}
          whileTap={isReady ? { scale: 0.96 } : {}}
          className={`w-full py-5 text-lg font-bold text-white rounded-2xl transition-all duration-300 ${
            isReady
              ? `${btnColor} shadow-lg shadow-black/10 cursor-pointer`
              : "bg-gray-200 cursor-not-allowed text-gray-400"
          }`}
        >
          {submitting ? (
            <span className="flex items-center justify-center gap-2">
              <svg className="w-5 h-5 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-20" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-80" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
              </svg>
              送信中...
            </span>
          ) : (
            `${mode}を打刻する`
          )}
        </motion.button>
      </motion.div>

      {/* エラー表示 */}
      {error && (
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="mt-4 text-sm text-center text-red-400"
        >
          ⚠️ {error}
        </motion.p>
      )}
    </motion.div>
  );
}
