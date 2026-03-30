"use client";

import { motion } from "framer-motion";

type StampType = "出勤" | "退勤";

type Props = {
  name: string;
  type: StampType;
  time: Date;
};

function pad(n: number) {
  return String(n).padStart(2, "0");
}

export default function SuccessScreen({ name, type, time }: Props) {
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
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.09 },
    },
  };
  const itemVariants = {
    hidden: { opacity: 0, y: 8 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.35 } },
  };

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="text-center py-6"
      style={{ borderTop: `8px solid ${accentColor}` }}
    >
      {/* ── スタンプチェックマーク ── */}
      <motion.div
        initial={{ scale: 0, rotate: -15, opacity: 0 }}
        animate={{ scale: [0, 1.35, 0.95, 1], rotate: [-15, 6, -3, 0], opacity: 1 }}
        transition={{
          duration: 0.55,
          times: [0, 0.5, 0.75, 1],
          ease: "easeOut",
          delay: 0.05,
        }}
        className="mx-auto mb-5 flex items-center justify-center rounded-full w-20 h-20"
        style={{ backgroundColor: accentColor }}
      >
        {/* チェックマーク SVG */}
        <motion.svg
          viewBox="0 0 52 52"
          className="w-10 h-10"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 0.35, delay: 0.4, ease: "easeOut" }}
        >
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
        <span className="inline-block text-lg font-bold mb-4" style={{ color: accentColor }}>
          {type}打刻完了
        </span>
      </motion.div>

      {/* 時刻（大きく） */}
      <motion.div
        variants={itemVariants}
        className="text-[60px] font-extrabold leading-none tracking-tighter text-gray-800 mb-1"
        style={{ fontFamily: "Helvetica Neue, Arial, sans-serif" }}
      >
        {h}:{min}
      </motion.div>

      {/* 日付 */}
      <motion.p variants={itemVariants} className="text-sm text-gray-400 tracking-widest mb-1">
        {y}.{m}.{d}
      </motion.p>

      {/* 名前 */}
      <motion.p variants={itemVariants} className="text-sm text-gray-400 tracking-widest mb-8">
        {name}
      </motion.p>

      {/* サブメッセージ */}
      <motion.p variants={itemVariants} className="text-sm text-gray-400 leading-relaxed">
        {subMsg}
      </motion.p>

      {/* Topに戻るボタン */}
      <motion.button
        variants={itemVariants}
        whileTap={{ scale: 0.96 }}
        onClick={() => window.location.reload()}
        className="mt-10 px-6 py-3 text-sm font-semibold text-gray-400 border border-gray-200 rounded-full hover:border-gray-300 hover:text-gray-500 transition-colors"
      >
        Topに戻る
      </motion.button>
    </motion.div>
  );
}
