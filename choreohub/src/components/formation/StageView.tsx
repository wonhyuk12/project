"use client";

import { useEffect, useRef, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Grid } from "@react-three/drei";
import { useFormationStore } from "@/lib/formation/store";
import { DancerFigure } from "./DancerFigure";

export function StageView({ projectId }: { projectId: string }) {
  const proj = useFormationStore((s) => s.byProject[projectId]);
  const renameDancer = useFormationStore((s) => s.renameDancer);
  const removeDancer = useFormationStore((s) => s.removeDancer);
  const section = proj?.sections.find((s) => s.id === proj.selectedSectionId);

  const [selectedDancerId, setSelectedDancerId] = useState<string | null>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const selectedDancer = section?.formation.dancers.find((d) => d.id === selectedDancerId);

  useEffect(() => {
    if (selectedDancerId) {
      nameInputRef.current?.focus();
      nameInputRef.current?.select();
    }
  }, [selectedDancerId]);

  return (
    <div className="relative h-full w-full">
      <Canvas
        shadows
        camera={{ position: [0, 4.5, 7], fov: 45 }}
        className="!bg-background"
        onPointerMissed={() => setSelectedDancerId(null)}
      >
        <ambientLight intensity={0.6} />
        <directionalLight
          position={[3, 6, 4]}
          intensity={1.1}
          castShadow
          shadow-mapSize={[1024, 1024]}
        />

        <Grid
          args={[20, 20]}
          cellSize={0.5}
          cellThickness={0.5}
          cellColor="#2a2a33"
          sectionSize={2.5}
          sectionThickness={1}
          sectionColor="#4c1d95"
          fadeDistance={18}
          fadeStrength={1.5}
          infiniteGrid
        />

        {section?.formation.dancers.map((d) => (
          <DancerFigure
            key={d.id}
            dancer={d}
            highlight={d.id === selectedDancerId}
            onSelect={() => setSelectedDancerId(d.id)}
          />
        ))}

        <OrbitControls
          enablePan={false}
          minDistance={2.5}
          maxDistance={16}
          maxPolarAngle={Math.PI / 2.1}
        />
      </Canvas>

      {selectedDancer && section && (
        <div className="absolute bottom-3 left-3 right-3 flex items-center gap-2 rounded-xl border border-border bg-surface/90 px-3 py-2 text-xs text-muted backdrop-blur">
          <span className="shrink-0">이름</span>
          <input
            ref={nameInputRef}
            key={selectedDancer.id}
            defaultValue={selectedDancer.label}
            onKeyDown={(e) => {
              if (e.key === "Enter") (e.target as HTMLInputElement).blur();
            }}
            onBlur={(e) => {
              const label = e.target.value.trim();
              if (label) renameDancer(projectId, section.id, selectedDancer.id, label);
              else e.target.value = selectedDancer.label;
            }}
            className="min-w-0 flex-1 rounded border border-border bg-background px-2 py-1 text-foreground outline-none focus:border-accent"
          />
          <button
            onClick={() => {
              removeDancer(projectId, section.id, selectedDancer.id);
              setSelectedDancerId(null);
            }}
            className="shrink-0 rounded border border-red-500/30 px-2 py-1 text-red-300 transition-colors hover:bg-red-500/10"
          >
            삭제
          </button>
        </div>
      )}
    </div>
  );
}
