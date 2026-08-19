import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ProjectHydrator } from "@/components/providers/ProjectHydrator";
import { ServiceWorkerRegistrar } from "@/components/providers/ServiceWorkerRegistrar";
import { SiteHeader } from "@/components/ui/SiteHeader";
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
  icons: {
    icon: "/favicon.ico",
    apple: "/logo.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#0a0a0f",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="ko"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col bg-background text-foreground">
        <ProjectHydrator />
        <ServiceWorkerRegistrar />
        <SiteHeader />
        {children}
      </body>
    </html>
  );
}
