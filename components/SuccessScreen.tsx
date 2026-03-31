"use client";

import { motion } from "framer-motion";
import { useRouter } from "next/navigation";

type StampType = "出勤" | "退勤";

type Props = {
  name: string;
  type: StampType;
  time: Date;
  employeeId?: string;
};

function pad(n: number) {
  return String(n).padStart(2, "0");
}

export default function SuccessScreen({ name, type, time, employeeId }: Props) {
  const router = useRouter();
  const isIn = type === "出勤";
  const accentColor = isIn ? "#3498db" : "#e74c3c";
  const subMsg = isIn ? "一日頑張りましょう！" : "お疲れさまでした！";

  const h = pad(time.getHours());
  const min = pad(time.getMinutes());
  const y = time.getFullYear();
  const m = pad(time.getMonth() + 1);
  const d = pad(time.getDate());

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.08 } },
  };
  const itemVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { duration: 0.3 } },
  };

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="text-center h-full flex flex-col pt-8 pb-8"
      style={{ borderTop: `6px solid ${accentColor}` }}
    >
      <div className="flex-1 flex flex-col justify-center">
      {/* チェックスタンプ */}
      <motion.div
        initial={{ scale: 0, rotate: -15, opacity: 0 }}
        animate={{ scale: [0, 1.35, 0.95, 1], rotate: [-15, 6, -3, 0], opacity: 1 }}
        transition={{ duration: 0.55, times: [0, 0.5, 0.75, 1], ease: "easeOut", delay: 0.05 }}
        className="mx-auto mb-6 flex items-center justify-center rounded-full w-48 h-48"
        style={{ backgroundColor: accentColor }}
      >
        <motion.svg viewBox="0 0 52 52" className="w-24 h-24">
          <motion.path
            fill="none"
            stroke="white"
            strokeWidth="5"
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M14 27 L22 35 L38 18"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 0.3, delay: 0.45, ease: "easeOut" }}
          />
        </motion.svg>
      </motion.div>

      {/* 完了ラベル */}
      <motion.div variants={itemVariants}>
        <span className="inline-block text-base font-bold mb-4" style={{ color: accentColor }}>
          {type}打刻完了
        </span>
      </motion.div>

      {/* 時刻 */}
      <motion.div
        variants={itemVariants}
        className="text-[64px] font-extrabold leading-none tracking-tighter text-gray-800 mb-2"
        style={{ fontFamily: "Helvetica Neue, Arial, sans-serif" }}
      >
        {h}:{min}
      </motion.div>

      {/* 日付・名前 */}
      <motion.p variants={itemVariants} className="text-sm text-gray-400 tracking-widest mb-1">
        {y}.{m}.{d}
      </motion.p>
      <motion.p variants={itemVariants} className="text-sm text-gray-400 tracking-widest mb-6">
        {name}
      </motion.p>

      {/* 早出・残業申請（退勤時のみ・名前の直下） */}
      {type === "退勤" && employeeId && (
        <motion.button
          variants={itemVariants}
          whileTap={{ scale: 0.96 }}
          onClick={() => router.push(`/apply?employeeId=${employeeId}&name=${encodeURIComponent(name)}&checkoutTime=${h}:${min}`)}
          className="mx-auto mb-6 px-6 py-2.5 text-sm font-semibold text-clock-blue border-2 border-clock-blue/30 rounded-full transition-colors"
        >
          早出・残業申請
        </motion.button>
      )}

      </div>

      {/* サブメッセージ */}
      <motion.div variants={itemVariants} className="flex-1 flex items-center justify-center">
        <p className="text-lg text-gray-400 leading-relaxed">{subMsg}</p>
      </motion.div>

      {/* Topに戻る */}
      <motion.button
        variants={itemVariants}
        whileTap={{ scale: 0.96 }}
        onClick={() => window.location.reload()}
        className="mx-auto px-6 py-2.5 text-sm font-semibold text-gray-400 border border-gray-200 rounded-full hover:border-gray-300 hover:text-gray-500 transition-colors"
      >
        Topに戻る
      </motion.button>
    </motion.div>
  );
}
