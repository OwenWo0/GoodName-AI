import type { Metadata } from "next";
import { SiteNav } from "@/components/site-nav";
import "./globals.css";

export const metadata: Metadata = {
  title: "问名手卷 · 古风起名（八字五格喜用神平仄）",
  description:
    "固定算法排盘（八字/五行/喜用神/五格/平仄，确定性可核对）+ AI 综合解读的古风中文起名工具。民俗文化参考，非科学结论。",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body className="antialiased">
        <SiteNav />
        {children}
      </body>
    </html>
  );
}
