"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";

type PunchRecord = { type: "出勤" | "退勤"; timeStr: string };

function ApplyForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const employeeId = searchParams.get("employeeId") ?? "";
  const name = searchParams.get("name") ?? "";
  const checkoutTime = searchParams.get("checkoutTime") ?? "";

  const [punches, setPunches] = useState<PunchRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [earlyCheck, setEarlyCheck] = useState(false);
  const [earlyReason, setEarlyReason] = useState("");
  const [overtimeCheck, setOvertimeCheck] = useState(false);
  const [overtimeReason, setOvertimeReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!employeeId) { setLoading(false); return; }
    fetch(`/api/punches?employeeId=${employeeId}`)
      .then((r) => r.ok ? r.json() : [])
      .then((data: PunchRecord[]) => { setPunches(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, [employeeId]);

  // 出勤：最早（Notionクエリから）、退勤：URLパラメーターを優先（レースコンディション回避）
  const checkIn  = punches.find((p) => p.type === "出勤");
  const checkOut = checkoutTime
    ? { type: "退勤" as const, timeStr: checkoutTime }
    : [...punches].reverse().find((p) => p.type === "退勤");

  const canSubmit = !submitting && !!employeeId &&
    ((earlyCheck && earlyReason.trim() !== "") ||
     (overtimeCheck && overtimeReason.trim() !== ""));

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setError("");
    const now = new Date();
    const jstNow = new Date(now.getTime() + 9 * 60 * 60 * 1000);
    const pad = (n: number) => String(n).padStart(2, "0");
    const applyDate = `${jstNow.getUTCFullYear()}-${pad(jstNow.getUTCMonth() + 1)}-${pad(jstNow.getUTCDate())}`;
    try {
      const res = await fetch("/api/overtime-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employeePageId: employeeId,
          employeeName: name,
          applyDate,
          earlyArrival: earlyCheck,
          earlyTime: checkIn?.timeStr ?? "",
          earlyReason,
          overtime: overtimeCheck,
          overtimeTime: checkOut?.timeStr ?? "",
          overtimeReason,
        }),
      });
      if (!res.ok) throw new Error();
      setSubmitted(true);
    } catch {
      setError("申請に失敗しました。もう一度お試しください。");
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="absolute bottom-10 left-0 right-0">
        <motion.div
          initial={{ opacity: 0, scale: 0.97 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-white rounded-3xl shadow-[0_10px_40px_rgba(0,0,0,0.06)] px-6 py-12 text-center"
        >
          <div className="w-16 h-16 bg-green-400 rounded-full flex items-center justify-center mx-auto mb-5">
            <svg viewBox="0 0 52 52" className="w-8 h-8">
              <path fill="none" stroke="white" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" d="M14 27 L22 35 L38 18" />
            </svg>
          </div>
          <p className="text-base font-bold text-gray-700 mb-1">申請しました</p>
          <p className="text-xs text-gray-400 mb-10">オーナーに通知されます</p>
          <button
            onClick={() => router.push("/")}
            className="w-full py-3.5 text-sm font-bold text-white bg-clock-blue rounded-2xl"
          >
            Topに戻る
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="absolute bottom-10 left-0 right-0">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: "easeOut" }}
        className="bg-white rounded-3xl shadow-[0_10px_40px_rgba(0,0,0,0.06)] overflow-hidden flex flex-col"
        style={{ maxHeight: "calc(100svh - 80px)" }}
      >
        {/* ヘッダー */}
        <div className="flex items-center px-6 pt-6 pb-4 border-b border-gray-100 shrink-0">
          <button onClick={() => router.back()} className="text-gray-300 mr-3 p-1">
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M19 12H5M12 5l-7 7 7 7" />
            </svg>
          </button>
          <div>
            <p className="text-sm font-bold text-gray-600">時間外申請</p>
            <p className="text-xs text-gray-400">{name}</p>
          </div>
        </div>

        {/* コンテンツ */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
          {loading ? (
            <div className="flex justify-center py-10">
              <svg className="w-6 h-6 animate-spin text-clock-blue" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-20" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-90" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
              </svg>
            </div>
          ) : (
            <>
              {/* 早出 */}
              <div className={`bg-gray-50 rounded-2xl p-4 transition-opacity ${!checkIn ? "opacity-40" : ""}`}>
                <div className="flex items-center mb-3">
                  <button
                    onClick={() => checkIn && setEarlyCheck(!earlyCheck)}
                    disabled={!checkIn}
                    className={`w-5 h-5 rounded border-2 flex items-center justify-center mr-3 shrink-0 transition-colors ${earlyCheck ? "bg-clock-blue border-clock-blue" : "border-gray-300 bg-white"}`}
                  >
                    {earlyCheck && (
                      <svg viewBox="0 0 12 12" className="w-3 h-3" fill="none">
                        <path d="M2 6L5 9L10 3" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </button>
                  <span className="text-sm font-bold text-gray-600 flex-1">早出</span>
                  <span className="text-sm font-bold text-clock-blue">{checkIn?.timeStr ?? "--:--"}</span>
                </div>
                <textarea
                  value={earlyReason}
                  onChange={(e) => setEarlyReason(e.target.value)}
                  disabled={!checkIn}
                  placeholder="理由を入力してください"
                  rows={2}
                  className="w-full text-sm px-3 py-2.5 rounded-xl border-2 border-gray-100 bg-white focus:outline-none focus:border-clock-blue/40 resize-none placeholder:text-gray-300"
                />
              </div>

              {/* 残業 */}
              <div className={`bg-gray-50 rounded-2xl p-4 transition-opacity ${!checkOut ? "opacity-40" : ""}`}>
                <div className="flex items-center mb-3">
                  <button
                    onClick={() => checkOut && setOvertimeCheck(!overtimeCheck)}
                    disabled={!checkOut}
                    className={`w-5 h-5 rounded border-2 flex items-center justify-center mr-3 shrink-0 transition-colors ${overtimeCheck ? "bg-clock-red border-clock-red" : "border-gray-300 bg-white"}`}
                  >
                    {overtimeCheck && (
                      <svg viewBox="0 0 12 12" className="w-3 h-3" fill="none">
                        <path d="M2 6L5 9L10 3" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </button>
                  <span className="text-sm font-bold text-gray-600 flex-1">残業</span>
                  <span className="text-sm font-bold text-clock-red">{checkOut?.timeStr ?? "--:--"}</span>
                </div>
                <textarea
                  value={overtimeReason}
                  onChange={(e) => setOvertimeReason(e.target.value)}
                  disabled={!checkOut}
                  placeholder="理由を入力してください"
                  rows={2}
                  className="w-full text-sm px-3 py-2.5 rounded-xl border-2 border-gray-100 bg-white focus:outline-none focus:border-clock-red/40 resize-none placeholder:text-gray-300"
                />
              </div>

              {error && <p className="text-xs text-red-400 text-center">{error}</p>}
            </>
          )}
        </div>

        {/* 申請ボタン */}
        <div className="px-6 py-4 border-t border-gray-100 shrink-0">
          <button
            onClick={handleSubmit}
            disabled={!canSubmit}
            className={`w-full py-4 text-sm font-bold rounded-2xl transition-all duration-300 ${
              canSubmit ? "bg-clock-blue text-white shadow-lg shadow-black/10" : "bg-gray-100 text-gray-300 cursor-not-allowed"
            }`}
          >
            {submitting ? "申請中..." : "申請する"}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

export default function ApplyPage() {
  return (
    <main className="h-dvh flex flex-col items-center px-4 overflow-hidden">
      <div className="w-full max-w-[400px] relative h-full">
        <Suspense fallback={null}>
          <ApplyForm />
        </Suspense>
      </div>
    </main>
  );
}
