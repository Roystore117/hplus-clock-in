import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "勤怠打刻システム",
  description: "H+ 勤怠打刻Webアプリ",
  // PWA用マニフェスト（後からmanifest.jsonを追加すれば有効になる）
  manifest: "/manifest.json",
  icons: { apple: "/icon-192.png" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#ffffff",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja">
      {/* viewport-fitでノッチ領域まで拡張 */}
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover" />
      </head>
      <body className="bg-[#f7f9fa] text-gray-800 antialiased">{children}</body>
    </html>
  );
}
