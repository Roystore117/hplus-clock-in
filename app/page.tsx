"use client";

import { motion, useAnimation } from "framer-motion";
import { useEffect, useState } from "react";
import LoadingScreen from "@/components/LoadingScreen";
import InputForm from "@/components/InputForm";
import SuccessScreen from "@/components/SuccessScreen";
import type { Employee } from "@/lib/notion";

type StampType = "出勤" | "退勤";
type Phase = "loading" | "input" | "success";

type SuccessData = {
  name: string;
  type: StampType;
  time: Date;
};

export default function Home() {
  const [phase, setPhase] = useState<Phase>("loading");
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [success, setSuccess] = useState<SuccessData | null>(null);
  const [fetchError, setFetchError] = useState("");
  const cardControls = useAnimation();

  useEffect(() => {
    fetch("/api/employees")
      .then((r) => {
        if (!r.ok) throw new Error("従業員データの取得に失敗しました");
        return r.json();
      })
      .then((data: Employee[]) => {
        setEmployees(data);
        setPhase("input");
      })
      .catch((err) => {
        setFetchError(err.message ?? "エラーが発生しました");
        setPhase("input");
      });
  }, []);

  // 初回フェードイン
  useEffect(() => {
    cardControls.start({ opacity: 1, y: 0, rotateY: 0, transition: { duration: 0.45, ease: "easeOut" } });
  }, []);

  const handleSuccess = async (name: string, type: StampType, time: Date) => {
    // フリップ前半: 90度まで回転（カードが消える）
    await cardControls.start({
      rotateY: 90,
      transition: { duration: 0.25, ease: "easeIn" },
    });
    // コンテンツを差し替え
    setSuccess({ name, type, time });
    setPhase("success");
    // フリップ後半: -90度から0度へ（カードが現れる → スタンプへ）
    cardControls.set({ rotateY: -90 });
    await cardControls.start({
      rotateY: 0,
      transition: { duration: 0.3, ease: "easeOut" },
    });
  };

  return (
    <main className="min-h-[100dvh] flex flex-col items-center justify-center px-4 py-6 sm:px-5 sm:py-8">
      <div className="w-full max-w-[400px]">
        <motion.h2
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-center text-sm font-bold text-gray-400 tracking-widest mb-6"
        >
          勤怠打刻システム
        </motion.h2>

        {/* perspective はカード外側のラッパーに設定 */}
        <div style={{ perspective: 1200 }}>
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={cardControls}
            className="bg-white rounded-3xl shadow-[0_10px_40px_rgba(0,0,0,0.06)] px-5 py-8 sm:px-8 sm:py-10 overflow-hidden"
          >
            <div>
              {phase === "loading" && <LoadingScreen />}

              {phase === "input" && (
                <>
                  {fetchError && (
                    <p className="mb-4 text-sm text-center text-red-400">
                      ⚠️ {fetchError}
                    </p>
                  )}
                  <InputForm employees={employees} onSuccess={handleSuccess} />
                </>
              )}

              {phase === "success" && success && (
                <SuccessScreen
                  name={success.name}
                  type={success.type}
                  time={success.time}
                />
              )}
            </div>
          </motion.div>
        </div>
      </div>
    </main>
  );
}
