import { create } from "zustand";
import type { Dancer, FormationSection } from "./types";
import { makeGridFormation, makeEmptyDancer, makeDancerAt } from "./formationUtils";

const DEFAULT_TOTAL_SEC = 240; // 4분, 버전 길이를 모를 때 폴백

interface FormationProjectState {
  sections: FormationSection[];
  totalDurationSec: number;
  selectedSectionId: string;
}

function buildDefaultProjectState(defaultDurationSec?: number): FormationProjectState {
  const total = Math.max(10, Math.round(defaultDurationSec ?? DEFAULT_TOTAL_SEC));
  const section: FormationSection = {
    id: `s-${Date.now()}`,
    name: "Intro",
    startSec: 0,
    endSec: total,
    formation: { dancers: [] },
  };
  return { sections: [section], totalDurationSec: total, selectedSectionId: section.id };
}

interface FormationStoreState {
  byProject: Record<string, FormationProjectState>;
  viewMode: "3d" | "2d";

  ensureProject: (projectId: string, defaultDurationSec?: number) => void;
  setViewMode: (mode: "3d" | "2d") => void;
  selectSection: (projectId: string, id: string) => void;
  addSection: (projectId: string) => void;
  renameSection: (projectId: string, id: string, name: string) => void;
  removeSection: (projectId: string, id: string) => void;
  updateSectionTiming: (projectId: string, id: string, startSec: number, endSec: number) => void;
  setTotalDurationSec: (projectId: string, sec: number) => void;

  applyGridFormation: (
    projectId: string,
    sectionId: string,
    rows: number,
    cols: number,
    count: number,
    rowSpacing: number,
    colSpacing: number,
  ) => void;
  updateDancerPosition: (
    projectId: string,
    sectionId: string,
    dancerId: string,
    x: number,
    z: number,
  ) => void;
  renameDancer: (projectId: string, sectionId: string, dancerId: string, label: string) => void;
  addDancer: (projectId: string, sectionId: string) => void;
  addDancerAt: (projectId: string, sectionId: string, x: number, z: number) => void;
  removeDancer: (projectId: string, sectionId: string, dancerId: string) => void;
  /** Replaces a section's dancer list wholesale — used by the "포즈로 초기화" flow. */
  setSectionFormation: (projectId: string, sectionId: string, dancers: Dancer[]) => void;
}

function mapSections(
  proj: FormationProjectState,
  sectionId: string,
  fn: (s: FormationSection) => FormationSection,
): FormationSection[] {
  return proj.sections.map((s) => (s.id === sectionId ? fn(s) : s));
}

export const useFormationStore = create<FormationStoreState>((set) => ({
  byProject: {},
  viewMode: "3d",

  ensureProject: (projectId, defaultDurationSec) =>
    set((state) => {
      if (state.byProject[projectId]) return state;
      return {
        byProject: {
          ...state.byProject,
          [projectId]: buildDefaultProjectState(defaultDurationSec),
        },
      };
    }),

  setViewMode: (mode) => set({ viewMode: mode }),

  selectSection: (projectId, id) =>
    set((state) => {
      const proj = state.byProject[projectId];
      if (!proj) return state;
      return {
        byProject: { ...state.byProject, [projectId]: { ...proj, selectedSectionId: id } },
      };
    }),

  addSection: (projectId) =>
    set((state) => {
      const proj = state.byProject[projectId];
      if (!proj) return state;
      const lastEnd = proj.sections.reduce((max, s) => Math.max(max, s.endSec), 0);
      const startSec = lastEnd;
      const endSec = startSec + 20;
      const newSection: FormationSection = {
        id: `s-${Date.now()}`,
        name: `구간 ${proj.sections.length + 1}`,
        startSec,
        endSec,
        formation: { dancers: [] },
      };
      return {
        byProject: {
          ...state.byProject,
          [projectId]: {
            ...proj,
            sections: [...proj.sections, newSection],
            selectedSectionId: newSection.id,
            totalDurationSec: Math.max(proj.totalDurationSec, endSec),
          },
        },
      };
    }),

  renameSection: (projectId, id, name) =>
    set((state) => {
      const proj = state.byProject[projectId];
      if (!proj) return state;
      return {
        byProject: {
          ...state.byProject,
          [projectId]: {
            ...proj,
            sections: mapSections(proj, id, (s) => ({ ...s, name })),
          },
        },
      };
    }),

  removeSection: (projectId, id) =>
    set((state) => {
      const proj = state.byProject[projectId];
      if (!proj) return state;
      const remaining = proj.sections.filter((s) => s.id !== id);
      const stillSelected = proj.selectedSectionId === id;
      return {
        byProject: {
          ...state.byProject,
          [projectId]: {
            ...proj,
            sections: remaining,
            selectedSectionId: stillSelected
              ? (remaining[0]?.id ?? "")
              : proj.selectedSectionId,
          },
        },
      };
    }),

  updateSectionTiming: (projectId, id, startSec, endSec) =>
    set((state) => {
      const proj = state.byProject[projectId];
      if (!proj) return state;
      const sorted = [...proj.sections].sort((a, b) => a.startSec - b.startSec);
      const idx = sorted.findIndex((s) => s.id === id);
      if (idx === -1) return state;
      const prev = sorted[idx - 1];
      const next = sorted[idx + 1];
      const lowerBound = prev ? prev.endSec : 0;
      const upperBound = next ? next.startSec : proj.totalDurationSec;

      const minLen = 1;
      let clampedStart = Math.max(lowerBound, Math.min(startSec, upperBound - minLen));
      let clampedEnd = Math.min(upperBound, Math.max(endSec, lowerBound + minLen));
      if (clampedEnd - clampedStart < minLen) {
        clampedEnd = Math.min(upperBound, clampedStart + minLen);
        clampedStart = Math.max(lowerBound, clampedEnd - minLen);
      }

      return {
        byProject: {
          ...state.byProject,
          [projectId]: {
            ...proj,
            sections: mapSections(proj, id, (s) => ({
              ...s,
              startSec: clampedStart,
              endSec: clampedEnd,
            })),
          },
        },
      };
    }),

  setTotalDurationSec: (projectId, sec) =>
    set((state) => {
      const proj = state.byProject[projectId];
      if (!proj) return state;
      const total = Math.max(10, Math.round(sec));
      const sections = proj.sections.map((s) => {
        const endSec = Math.min(s.endSec, total);
        const startSec = Math.min(s.startSec, Math.max(0, endSec - 1));
        return { ...s, startSec, endSec };
      });
      return {
        byProject: {
          ...state.byProject,
          [projectId]: { ...proj, totalDurationSec: total, sections },
        },
      };
    }),

  applyGridFormation: (projectId, sectionId, rows, cols, count, rowSpacing, colSpacing) =>
    set((state) => {
      const proj = state.byProject[projectId];
      if (!proj) return state;
      return {
        byProject: {
          ...state.byProject,
          [projectId]: {
            ...proj,
            sections: mapSections(proj, sectionId, (s) => ({
              ...s,
              formation: makeGridFormation(rows, cols, count, rowSpacing, colSpacing),
            })),
          },
        },
      };
    }),

  updateDancerPosition: (projectId, sectionId, dancerId, x, z) =>
    set((state) => {
      const proj = state.byProject[projectId];
      if (!proj) return state;
      return {
        byProject: {
          ...state.byProject,
          [projectId]: {
            ...proj,
            sections: mapSections(proj, sectionId, (s) => ({
              ...s,
              formation: {
                dancers: s.formation.dancers.map((d) =>
                  d.id === dancerId ? { ...d, x, z } : d,
                ),
              },
            })),
          },
        },
      };
    }),

  renameDancer: (projectId, sectionId, dancerId, label) =>
    set((state) => {
      const proj = state.byProject[projectId];
      if (!proj) return state;
      return {
        byProject: {
          ...state.byProject,
          [projectId]: {
            ...proj,
            sections: mapSections(proj, sectionId, (s) => ({
              ...s,
              formation: {
                dancers: s.formation.dancers.map((d) =>
                  d.id === dancerId ? { ...d, label } : d,
                ),
              },
            })),
          },
        },
      };
    }),

  addDancer: (projectId, sectionId) =>
    set((state) => {
      const proj = state.byProject[projectId];
      if (!proj) return state;
      return {
        byProject: {
          ...state.byProject,
          [projectId]: {
            ...proj,
            sections: mapSections(proj, sectionId, (s) => ({
              ...s,
              formation: {
                dancers: [...s.formation.dancers, makeEmptyDancer(s.formation.dancers.length)],
              },
            })),
          },
        },
      };
    }),

  addDancerAt: (projectId, sectionId, x, z) =>
    set((state) => {
      const proj = state.byProject[projectId];
      if (!proj) return state;
      return {
        byProject: {
          ...state.byProject,
          [projectId]: {
            ...proj,
            sections: mapSections(proj, sectionId, (s) => ({
              ...s,
              formation: {
                dancers: [
                  ...s.formation.dancers,
                  makeDancerAt(s.formation.dancers.length, x, z),
                ],
              },
            })),
          },
        },
      };
    }),

  removeDancer: (projectId, sectionId, dancerId) =>
    set((state) => {
      const proj = state.byProject[projectId];
      if (!proj) return state;
      return {
        byProject: {
          ...state.byProject,
          [projectId]: {
            ...proj,
            sections: mapSections(proj, sectionId, (s) => ({
              ...s,
              formation: { dancers: s.formation.dancers.filter((d) => d.id !== dancerId) },
            })),
          },
        },
      };
    }),

  setSectionFormation: (projectId, sectionId, dancers) =>
    set((state) => {
      const proj = state.byProject[projectId];
      if (!proj) return state;
      return {
        byProject: {
          ...state.byProject,
          [projectId]: {
            ...proj,
            sections: mapSections(proj, sectionId, (s) => ({
              ...s,
              formation: { dancers },
            })),
          },
        },
      };
    }),
}));
