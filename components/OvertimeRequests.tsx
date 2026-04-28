"use client";

import { useEffect, useState } from "react";
import { adminFetch } from "@/lib/adminFetch";

type OvertimeRequest = {
  id: string;
  employeeId: string;
  employeeName: string;
  applyDate: string;
  earlyArrival: boolean;
  earlyTime: string;
  earlyReason: string;
  overtime: boolean;
  overtimeTime: string;
  overtimeReason: string;
  status: string;
};

type StatusTab = "未対応" | "承認済み" | "却下";

const STATUS_TABS: StatusTab[] = ["未対応", "承認済み", "却下"];

export default function OvertimeRequests({ onActionDone }: { onActionDone?: () => void } = {}) {
  const [activeStatus, setActiveStatus] = useState<StatusTab>("未対応");
  const [requests, setRequests] = useState<OvertimeRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState("");

  const fetchRequests = (status: StatusTab) => {
    setLoading(true);
    setLoadError(false);
    adminFetch(`/api/admin/overtime-requests?status=${encodeURIComponent(status)}`)
      .then((r) => r.ok ? r.json() : Promise.reject(new Error("取得失敗")))
      .then((data: OvertimeRequest[]) => setRequests(data))
      .catch(() => setLoadError(true))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchRequests(activeStatus);
  }, [activeStatus]);

  const handleAction = async (id: string, action: "approve" | "reject") => {
    setProcessingId(id);
    setActionError("");
    try {
      const res = await adminFetch(`/api/admin/overtime-requests/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.detail ?? data?.error ?? "処理失敗");
      }
      // 一覧を再取得 + 親（左メニューバッジ）に通知
      fetchRequests(activeStatus);
      onActionDone?.();
    } catch (e: any) {
      setActionError(e?.message ?? "処理に失敗しました");
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <div className="h-full flex flex-col">
      {/* ステータスタブ */}
      <div className="flex items-center gap-2 px-6 pt-4 pb-3 border-b border-gray-100 shrink-0">
        {STATUS_TABS.map((s) => (
          <button
            key={s}
            onClick={() => setActiveStatus(s)}
            className={`px-4 py-1.5 text-xs font-bold rounded-full transition-colors ${
              activeStatus === s
                ? "bg-clock-blue text-white"
                : "bg-slate-100 text-gray-400 hover:text-gray-600"
            }`}
          >
            {s}
          </button>
        ))}
      </div>

      {/* コンテンツ */}
      <div className="flex-1 overflow-y-auto px-6 py-4">
        {loading ? (
          <div className="h-full flex flex-col items-center justify-center gap-3 py-20">
            <svg className="w-7 h-7 animate-spin text-clock-blue" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-20" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-90" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
            </svg>
            <p className="text-[10px] font-bold text-gray-400 tracking-[0.2em]">NOTION 連携中</p>
          </div>
        ) : loadError ? (
          <div className="h-full flex flex-col items-center justify-center gap-4">
            <p className="text-sm text-gray-500">取得に失敗しました</p>
            <button onClick={() => fetchRequests(activeStatus)} className="px-5 py-2 text-sm font-bold text-clock-blue border border-clock-blue/30 rounded-full hover:bg-clock-blue/5">
              再読み込み
            </button>
          </div>
        ) : requests.length === 0 ? (
          <div className="h-full flex items-center justify-center">
            <p className="text-sm text-gray-300">{activeStatus} の申請はありません</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {actionError && (
              <p className="text-xs text-red-400 text-center bg-red-50 py-2 rounded-lg">{actionError}</p>
            )}
            {requests.map((req) => (
              <div key={req.id} className="border border-gray-100 rounded-2xl p-4 bg-white">
                <div className="flex items-baseline gap-3 mb-3 pb-2 border-b border-gray-50">
                  <span className="text-sm font-bold text-gray-600 tabular-nums">{req.applyDate}</span>
                  <span className="text-sm font-bold text-gray-700">{req.employeeName || "—"}</span>
                  <span className="ml-auto text-[10px] text-gray-300">{req.status}</span>
                </div>

                <div className="space-y-2 mb-3">
                  {req.earlyArrival && (
                    <div className="flex items-start gap-3">
                      <span className="text-xs font-bold text-clock-blue shrink-0 w-12">早出</span>
                      <span className="text-xs font-bold text-gray-600 tabular-nums shrink-0 w-12">{req.earlyTime || "--:--"}</span>
                      <span className="text-xs text-gray-500 flex-1">{req.earlyReason || "—"}</span>
                    </div>
                  )}
                  {req.overtime && (
                    <div className="flex items-start gap-3">
                      <span className="text-xs font-bold text-clock-blue shrink-0 w-12">残業</span>
                      <span className="text-xs font-bold text-gray-600 tabular-nums shrink-0 w-12">{req.overtimeTime || "--:--"}</span>
                      <span className="text-xs text-gray-500 flex-1">{req.overtimeReason || "—"}</span>
                    </div>
                  )}
                  {!req.earlyArrival && !req.overtime && (
                    <p className="text-xs text-gray-300">早出・残業のチェックなし</p>
                  )}
                </div>

                {activeStatus === "未対応" && (
                  <div className="flex justify-end gap-2 pt-2 border-t border-gray-50">
                    <button
                      onClick={() => handleAction(req.id, "reject")}
                      disabled={processingId === req.id}
                      className="px-4 py-1.5 text-xs font-bold text-gray-500 border border-gray-200 rounded-full hover:bg-slate-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      却下
                    </button>
                    <button
                      onClick={() => handleAction(req.id, "approve")}
                      disabled={processingId === req.id}
                      className="px-4 py-1.5 text-xs font-bold text-white bg-clock-blue rounded-full hover:bg-clock-blue/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      {processingId === req.id ? "処理中..." : "承認"}
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
