"use client";

import { useState } from "react";
import Link from "next/link";
import { TopBar } from "@/components/ui/TopBar";
import { Logo } from "@/components/ui/Logo";
import { NotificationBell } from "@/components/ui/NotificationBell";
import { ProjectCard } from "@/components/dashboard/ProjectCard";
import { LogoutButton } from "@/components/auth/LogoutButton";
import { useProjectStore } from "@/lib/store";
import { filterProjects, type ProjectFilter } from "@/lib/filterProjects";

const TABS: { key: ProjectFilter; label: string }[] = [
  { key: "all", label: "전체" },
  { key: "in_progress", label: "진행중" },
  { key: "completed", label: "완료" },
];

export default function DashboardPage() {
  const projects = useProjectStore((s) => s.projects);
  const [filter, setFilter] = useState<ProjectFilter>("all");
  const filtered = filterProjects(projects, filter);

  return (
    <div className="mx-auto flex min-h-svh w-full max-w-md flex-col border-border sm:border-x md:max-w-5xl md:border-x-0">
      <div className="md:hidden">
        <TopBar
          titleAlign="left"
          title={
            <span className="flex items-center gap-1.5">
              <Logo size={20} />
              ChoreoHub
            </span>
          }
          right={
            <>
              <Link
                href="/community"
                className="flex h-8 w-8 items-center justify-center rounded-full text-base leading-none text-muted transition-colors hover:bg-surface-hover hover:text-foreground"
                aria-label="커뮤니티"
                title="커뮤니티"
              >
                🌐
              </Link>
              <NotificationBell />
              <Link
                href="/billing"
                className="flex h-8 w-8 items-center justify-center rounded-full text-base leading-none text-muted transition-colors hover:bg-surface-hover hover:text-foreground"
                aria-label="요금제"
                title="요금제"
              >
                ✨
              </Link>
              <Link
                href="/projects/new"
                className="flex h-8 items-center justify-center rounded-full px-3 text-xs font-medium text-muted transition-colors hover:bg-surface-hover hover:text-foreground"
                aria-label="프로젝트 생성"
                title="프로젝트 생성"
              >
                프로젝트 생성
              </Link>
              <LogoutButton />
            </>
          }
        />
      </div>

      <div className="flex items-center justify-between gap-2 px-4 pb-3 pt-4 md:px-8 md:pt-8">
        <div className="flex gap-2">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setFilter(t.key)}
              className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                filter === t.key
                  ? "bg-accent text-white"
                  : "border border-border bg-surface text-muted hover:bg-surface-hover"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <Link
          href="/projects/new"
          className="hidden items-center gap-1.5 rounded-full bg-accent px-4 py-1.5 text-xs font-medium text-white transition-colors hover:bg-accent-light md:flex"
        >
          프로젝트 생성
        </Link>
      </div>

      <div className="flex-1 px-4 pb-8 md:px-8">
        {filtered.length === 0 ? (
          <p className="pt-10 text-center text-sm text-muted">
            해당하는 프로젝트가 없어요
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {filtered.map((p) => (
              <ProjectCard key={p.id} project={p} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
