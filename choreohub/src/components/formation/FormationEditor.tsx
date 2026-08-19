"use client";

import { useEffect, useState } from "react";
import { useFormationStore } from "@/lib/formation/store";
import { useProjectStore } from "@/lib/store";
import { poseFrameToDancers, findClosestPoseFrame } from "@/lib/formation/poseToFormation";
import { FormationCanvas2D } from "./FormationCanvas2D";
import { GridGeneratorPanel } from "./GridGeneratorPanel";
import { DancerTable } from "./DancerTable";

export function FormationEditor({ projectId }: { projectId: string }) {
  const proj = useFormationStore((s) => s.byProject[projectId]);
  const setSectionFormation = useFormationStore((s) => s.setSectionFormation);
  const removeDancer = useFormationStore((s) => s.removeDancer);
  const allVersions = useProjectStore((s) => s.versions);
  const versions = allVersions.filter((v) => v.projectId === projectId);

  const section = proj?.sections.find((s) => s.id === proj.selectedSectionId);
  const [selectedDancerId, setSelectedDancerId] = useState<string | null>(null);
  const [rowSpacing, setRowSpacing] = useState(1.4);
  const [colSpacing, setColSpacing] = useState(1.4);
  const [snapEnabled, setSnapEnabled] = useState(true);
  const [poseVersionId, setPoseVersionId] = useState(versions[0]?.id ?? "");

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (!selectedDancerId || !section) return;
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return; // 텍스트 입력 중엔 무시
      if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        removeDancer(projectId, section.id, selectedDancerId);
        setSelectedDancerId(null);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [projectId, section, selectedDancerId, removeDancer]);

  if (!proj || !section) return null;

  function initFromPose() {
    if (!section) return;
    const version = versions.find((v) => v.id === poseVersionId);
    if (!version) return;
    const midpoint = (section.startSec + section.endSec) / 2;
    const frame = findClosestPoseFrame(version.poseData, midpoint);
    if (!frame || frame.persons.length === 0) {
      window.alert("이 버전의 해당 구간 근처에서 감지된 사람이 없어요.");
      return;
    }
    const dancers = poseFrameToDancers(frame);
    setSectionFormation(projectId, section.id, dancers);
  }

  function initAllSectionsFromPose() {
    if (!proj) return;
    const version = versions.find((v) => v.id === poseVersionId);
    if (!version) return;
    if (
      !window.confirm(
        `이 버전 기반으로 전체 ${proj.sections.length}개 구간을 자동 배치할까요? 각 구간의 기존 배치는 덮어써져요.`,
      )
    ) {
      return;
    }
    let applied = 0;
    for (const s of proj.sections) {
      const midpoint = (s.startSec + s.endSec) / 2;
      const frame = findClosestPoseFrame(version.poseData, midpoint);
      if (frame && frame.persons.length > 0) {
        setSectionFormation(projectId, s.id, poseFrameToDancers(frame));
        applied += 1;
      }
    }
    window.alert(`${applied}/${proj.sections.length}개 구간에 자동 배치했어요.`);
  }

  return (
    <div className="flex h-full flex-col gap-3 overflow-y-auto p-3">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border border-border bg-surface/60 px-3 py-2 text-xs text-muted">
        <label className="flex items-center gap-1.5">
          <input
            type="checkbox"
            checked={snapEnabled}
            onChange={(e) => setSnapEnabled(e.target.checked)}
            className="accent-accent"
          />
          행·열 격자에 맞추기
        </label>
        <label className="flex items-center gap-1.5">
          행 간격
          <input
            type="number"
            min={0.3}
            step={0.1}
            value={rowSpacing}
            onChange={(e) => setRowSpacing(Math.max(0.3, Number(e.target.value)))}
            className="w-16 rounded-lg border border-border bg-background px-2 py-1 text-foreground"
          />
          m
        </label>
        <label className="flex items-center gap-1.5">
          열 간격
          <input
            type="number"
            min={0.3}
            step={0.1}
            value={colSpacing}
            onChange={(e) => setColSpacing(Math.max(0.3, Number(e.target.value)))}
            className="w-16 rounded-lg border border-border bg-background px-2 py-1 text-foreground"
          />
          m
        </label>
      </div>

      {versions.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-surface/60 px-3 py-2 text-xs text-muted">
          <span>포즈로 초기화</span>
          <select
            value={poseVersionId}
            onChange={(e) => setPoseVersionId(e.target.value)}
            className="rounded-lg border border-border bg-background px-2 py-1 text-foreground"
          >
            {versions.map((v) => (
              <option key={v.id} value={v.id}>
                {v.label}
              </option>
            ))}
          </select>
          <button
            onClick={initFromPose}
            className="rounded-lg border border-border bg-background px-2 py-1 text-foreground transition-colors hover:bg-surface-hover"
          >
            현재 구간에 적용
          </button>
          <button
            onClick={initAllSectionsFromPose}
            className="rounded-lg bg-accent px-2 py-1 text-white transition-colors hover:bg-accent-light"
          >
            전체 구간에 자동 배치
          </button>
          <span className="w-full text-[11px] text-muted-2">
            선택한 버전에서 감지된 사람들의 발 위치로 대략 배치하고, 아래에서 드래그로
            보정하세요. &quot;전체 구간에 자동 배치&quot;는 타임라인의 모든 구간을 각
            구간 중간 시점 기준으로 한 번에 채워요
          </span>
        </div>
      )}

      <FormationCanvas2D
        projectId={projectId}
        sectionId={section.id}
        dancers={section.formation.dancers}
        selectedId={selectedDancerId}
        onSelect={setSelectedDancerId}
        rowSpacing={rowSpacing}
        colSpacing={colSpacing}
        snapEnabled={snapEnabled}
      />
      <GridGeneratorPanel
        projectId={projectId}
        sectionId={section.id}
        rowSpacing={rowSpacing}
        colSpacing={colSpacing}
        onRowSpacingChange={setRowSpacing}
        onColSpacingChange={setColSpacing}
      />
      <DancerTable
        projectId={projectId}
        sectionId={section.id}
        dancers={section.formation.dancers}
        selectedId={selectedDancerId}
        onSelect={setSelectedDancerId}
        rowSpacing={rowSpacing}
        colSpacing={colSpacing}
        snapEnabled={snapEnabled}
      />
    </div>
  );
}
