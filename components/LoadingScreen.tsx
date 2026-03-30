"use client";

import { motion } from "framer-motion";
import { useEffect, useState } from "react";

const TIPS = [
  "深呼吸をひとつ。\n肩の力を抜いてみましょう。",
  "お水飲みましたか？\nこまめな水分補給を。",
  "無理なく続いてたら\nそれで100点満点！",
  "滑り台を心から楽しめる\n大人でありたいですね。",
  "『何もしない』というのも\n立派な予定のひとつです。",
  "ため息をつくのは\n悪いものを出している証拠です。",
  "大人だって\nプリンをご褒美に買っていい。",
  "疲れたら\n30秒だけ目を閉じてみましょう。",
  "背筋をぐーっと\n伸ばしてみましょう！",
  "あなたの笑顔が\n誰かの元気になっています！",
];

export default function LoadingScreen() {
  const [tip, setTip] = useState("");

  useEffect(() => {
    setTip(TIPS[Math.floor(Math.random() * TIPS.length)]);
  }, []);

  return (
    <motion.div
      key="loading"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -16 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className="flex flex-col items-center justify-center py-8"
    >
      {/* スピナー */}
      <div className="relative mb-7">
        {/* 外側のパルスリング */}
        <span className="absolute inset-0 rounded-full bg-clock-blue/20 animate-pulse-ring" />
        <svg
          className="w-10 h-10 animate-spin text-clock-blue"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle
            className="opacity-20"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className="opacity-90"
            fill="currentColor"
            d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
          />
        </svg>
      </div>

      {/* ステータステキスト */}
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
        className="text-xs text-gray-400 font-medium tracking-widest mb-9"
      >
        準備しています...
      </motion.p>

      {/* 保健師さんの一言 */}
      <motion.div
        initial={{ opacity: 0, x: -8 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 0.35, duration: 0.5 }}
        className="inline-block text-left border-l-4 border-blue-100 pl-4 mx-2"
      >
        <span className="block text-[11px] text-blue-300 font-bold tracking-wider mb-2">
          保健師さんの一言
        </span>
        <p className="text-[17px] leading-relaxed text-clock-blue font-bold whitespace-pre-wrap">
          {tip}
        </p>
      </motion.div>
    </motion.div>
  );
}
