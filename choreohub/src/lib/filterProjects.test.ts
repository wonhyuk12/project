import { describe, expect, it } from "vitest";
import { filterProjects } from "./filterProjects";
import type { Project } from "./types";

const base: Omit<Project, "id" | "status"> = {
  ownerId: "owner-1",
  title: "t",
  songName: "s",
  bpm: 120,
  description: "",
  memberCount: 1,
  versionCount: 1,
  updatedAt: "2026-01-01",
  thumbnailColor: "from-violet-600 to-fuchsia-700",
  license: "연습 전용",
};

const projects: Project[] = [
  { ...base, id: "1", status: "in_progress" },
  { ...base, id: "2", status: "completed" },
  { ...base, id: "3", status: "in_progress" },
];

describe("filterProjects", () => {
  it("returns everything for 'all'", () => {
    expect(filterProjects(projects, "all")).toHaveLength(3);
  });

  it("filters to only in_progress", () => {
    const result = filterProjects(projects, "in_progress");
    expect(result.map((p) => p.id)).toEqual(["1", "3"]);
  });

  it("filters to only completed", () => {
    const result = filterProjects(projects, "completed");
    expect(result.map((p) => p.id)).toEqual(["2"]);
  });
});
