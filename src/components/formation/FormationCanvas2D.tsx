"use client";

import { useRef } from "react";
import { useFormationStore } from "@/lib/formation/store";
import { snapTo } from "@/lib/formation/formationUtils";
import type { Dancer } from "@/lib/formation/types";

const VIEW = 320; // svg viewBox size (square)
const STAGE_HALF = 4; // meters shown from center to edge
const PX_PER_M = VIEW / (STAGE_HALF * 2);
const CENTER = VIEW / 2;

function toSvg(m: number) {
  return CENTER + m * PX_PER_M;
}

function clamp(m: number) {
  return Math.max(-STAGE_HALF + 0.1, Math.min(STAGE_HALF - 0.1, m));
}

interface Props {
  projectId: string;
  sectionId: string;
  dancers: Dancer[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  rowSpacing: number; // z axis (앞뒤)
  colSpacing: number; // x axis (좌우)
  snapEnabled: boolean;
}

export function FormationCanvas2D({
  projectId,
  sectionId,
  dancers,
  selectedId,
  onSelect,
  rowSpacing,
  colSpacing,
  snapEnabled,
}: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const updateDancerPosition = useFormationStore((s) => s.updateDancerPosition);
  const addDancerAt = useFormationStore((s) => s.addDancerAt);

  function clientToStage(clientX: number, clientY: number) {
    const rect = svgRef.current!.getBoundingClientRect();
    const scaleX = VIEW / rect.width;
    const scaleY = VIEW / rect.height;
    const px = (clientX - rect.left) * scaleX;
    const py = (clientY - rect.top) * scaleY;
    const rawX = (px - CENTER) / PX_PER_M;
    const rawZ = (py - CENTER) / PX_PER_M;
    const stepX = snapEnabled ? colSpacing : 0;
    const stepZ = snapEnabled ? rowSpacing : 0;
    return { x: clamp(snapTo(rawX, stepX)), z: clamp(snapTo(rawZ, stepZ)) };
  }

  function handleBackgroundDown(e: React.PointerEvent<SVGRectElement>) {
    const { x, z } = clientToStage(e.clientX, e.clientY);
    addDancerAt(projectId, sectionId, x, z);
  }

  function handleDancerDown(e: React.PointerEvent<SVGGElement>, id: string) {
    e.stopPropagation();
    (e.currentTarget as SVGGElement).setPointerCapture(e.pointerId);
    onSelect(id);
  }

  function handleDancerMove(e: React.PointerEvent<SVGGElement>, id: string) {
    if (!(e.currentTarget as SVGGElement).hasPointerCapture(e.pointerId)) return;
    const { x, z } = clientToStage(e.clientX, e.clientY);
    updateDancerPosition(projectId, sectionId, id, x, z);
  }

  function handleDancerUp(e: React.PointerEvent<SVGGElement>) {
    (e.currentTarget as SVGGElement).releasePointerCapture(e.pointerId);
  }

  function linesFor(step: number) {
    const out: number[] = [0];
    for (let m = step; m <= STAGE_HALF + 0.001; m += step) {
      out.push(m, -m);
    }
    return out;
  }
  const xLines = linesFor(colSpacing > 0 ? colSpacing : 1);
  const zLines = linesFor(rowSpacing > 0 ? rowSpacing : 1);

  const intersections: Array<[number, number]> = [];
  if (snapEnabled) {
    for (const gx of xLines) {
      for (const gz of zLines) {
        intersections.push([gx, gz]);
      }
    }
  }

  return (
    <div className="w-full">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${VIEW} ${VIEW}`}
        className="aspect-square w-full touch-none rounded-xl bg-background"
      >
        {xLines.map((m) => (
          <line
            key={`v${m}`}
            x1={toSvg(m)}
            y1={0}
            x2={toSvg(m)}
            y2={VIEW}
            stroke={m === 0 ? "#4c1d95" : "#27272a"}
            strokeWidth={m === 0 ? 1.2 : 1}
          />
        ))}
        {zLines.map((m) => (
          <line
            key={`h${m}`}
            x1={0}
            y1={toSvg(m)}
            x2={VIEW}
            y2={toSvg(m)}
            stroke={m === 0 ? "#4c1d95" : "#27272a"}
            strokeWidth={m === 0 ? 1.2 : 1}
          />
        ))}

        {/* snap intersections: show exactly where a dancer will lock into place */}
        {intersections.map(([gx, gz]) => (
          <circle key={`pt${gx}-${gz}`} cx={toSvg(gx)} cy={toSvg(gz)} r={1.6} fill="#52525b" />
        ))}

        {/* click-to-add background */}
        <rect
          x={0}
          y={0}
          width={VIEW}
          height={VIEW}
          fill="transparent"
          onPointerDown={handleBackgroundDown}
        />

        {/* audience-side label */}
        <text x={CENTER} y={VIEW - 6} fontSize={10} fill="#52525b" textAnchor="middle">
          객석 방향
        </text>

        {dancers.map((d) => {
          const selected = d.id === selectedId;
          return (
            <g
              key={d.id}
              transform={`translate(${toSvg(d.x)}, ${toSvg(d.z)})`}
              onPointerDown={(e) => handleDancerDown(e, d.id)}
              onPointerMove={(e) => handleDancerMove(e, d.id)}
              onPointerUp={handleDancerUp}
              className="cursor-grab active:cursor-grabbing"
            >
              <circle
                r={12}
                fill={selected ? "#c084fc" : "#8b5cf6"}
                stroke={selected ? "#f5f3ff" : "#4c1d95"}
                strokeWidth={selected ? 2 : 1}
              />
              <text y={4} fontSize={10} fill="#0b0b0f" textAnchor="middle" className="select-none">
                {d.label}
              </text>
            </g>
          );
        })}
      </svg>
      <p className="mt-1.5 text-center text-xs text-muted-2">
        빈 곳 클릭 = 인원 추가 · 점 드래그 = 위치 이동
        {snapEnabled
          ? ` · 행 ${rowSpacing}m / 열 ${colSpacing}m 격자에 스냅`
          : " · 자유 배치(스냅 꺼짐)"}
      </p>
    </div>
  );
}
