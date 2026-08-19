"use client";

import { Text } from "@react-three/drei";
import type { Dancer } from "@/lib/formation/types";

interface Props {
  dancer: Dancer;
  highlight?: boolean;
  onSelect?: () => void;
}

export function DancerFigure({ dancer, highlight, onSelect }: Props) {
  const color = highlight ? "#c084fc" : "#a1a1aa";

  return (
    <group
      position={[dancer.x, 0, dancer.z]}
      onClick={(e) => {
        e.stopPropagation();
        onSelect?.();
      }}
      onPointerOver={() => (document.body.style.cursor = "pointer")}
      onPointerOut={() => (document.body.style.cursor = "auto")}
    >
      {/* body */}
      <mesh position={[0, 0.62, 0]} castShadow>
        <capsuleGeometry args={[0.18, 0.55, 4, 8]} />
        <meshStandardMaterial color={color} roughness={0.5} metalness={0.1} />
      </mesh>
      {/* head */}
      <mesh position={[0, 1.15, 0]} castShadow>
        <sphereGeometry args={[0.16, 16, 16]} />
        <meshStandardMaterial color={color} roughness={0.5} metalness={0.1} />
      </mesh>
      {/* floor marker */}
      <mesh position={[0, 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.2, 0.26, 24]} />
        <meshBasicMaterial color="#8b5cf6" transparent opacity={0.6} />
      </mesh>
      <Text
        position={[0, 1.55, 0]}
        fontSize={0.22}
        color="#e5e5ea"
        anchorX="center"
        anchorY="bottom"
      >
        {dancer.label}
      </Text>
    </group>
  );
}
