"use client";

import { useEffect } from "react";
import { useProjectStore } from "@/lib/store";
import { useCompareStore } from "@/lib/compare/store";
import { usePlanStore } from "@/lib/plan/store";
import { useUserStore } from "@/lib/user/store";

/** 앱 어디로 들어오든(새로고침 포함) 로그인한 사용자의 프로젝트/버전/비교 기록/요금제/이름을
 *  한 번 불러온다. 화면에는 아무것도 그리지 않는다. */
export function ProjectHydrator() {
  const projectsHydrated = useProjectStore((s) => s.hydrated);
  const hydrateProjects = useProjectStore((s) => s.hydrate);
  const runsHydrated = useCompareStore((s) => s.hydrated);
  const hydrateRuns = useCompareStore((s) => s.hydrate);
  const planHydrated = usePlanStore((s) => s.hydrated);
  const hydratePlan = usePlanStore((s) => s.hydrate);
  const userHydrated = useUserStore((s) => s.hydrated);
  const hydrateUser = useUserStore((s) => s.hydrate);

  useEffect(() => {
    if (!projectsHydrated) hydrateProjects();
  }, [projectsHydrated, hydrateProjects]);

  useEffect(() => {
    if (!runsHydrated) hydrateRuns();
  }, [runsHydrated, hydrateRuns]);

  useEffect(() => {
    if (!planHydrated) hydratePlan();
  }, [planHydrated, hydratePlan]);

  useEffect(() => {
    if (!userHydrated) hydrateUser();
  }, [userHydrated, hydrateUser]);

  return null;
}
