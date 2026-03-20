import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "건축 법규검토 MVP",
  description: "대지위치 기반 토지이용계획 조회 및 실무형 AI 해설 MVP",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
