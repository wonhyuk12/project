import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ProjectHydrator } from "@/components/providers/ProjectHydrator";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "ChoreoHub",
  description: "안무 기록·분석 웹앱 ChoreoHub",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="ko"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col bg-background text-foreground">
        <ProjectHydrator />
        {children}
      </body>
    </html>
  );
}
