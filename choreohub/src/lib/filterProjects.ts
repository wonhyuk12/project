import type { Project, ProjectStatus } from "./types";

export type ProjectFilter = "all" | ProjectStatus;

export function filterProjects(projects: Project[], filter: ProjectFilter): Project[] {
  if (filter === "all") return projects;
  return projects.filter((p) => p.status === filter);
}
