"use client";

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Outlines } from "@react-three/drei";
import * as THREE from "three";
import { Leg, type LegConfig } from "./Leg";
import { attackPulse } from "./animation";

const BODY_COLOR = "#5d2283";
const HEAD_COLOR = "#7c4da8";
const INK = "#0b0710";

const LEG_ROWS: Array<{ z: number; forwardBiasDeg: number }> = [
  { z: 0.5, forwardBiasDeg: 40 },
  { z: 0.18, forwardBiasDeg: 14 },
  { z: -0.18, forwardBiasDeg: -14 },
  { z: -0.5, forwardBiasDeg: -40 },
];

const LEGS: LegConfig[] = LEG_ROWS.flatMap((row, i) => [
  {
    attach: [0.42, 0.05, row.z] as [number, number, number],
    side: 1 as const,
    forwardBiasDeg: row.forwardBiasDeg,
    phase: i * 0.9,
    isFront: i === 0,
    color: BODY_COLOR,
  },
  {
    attach: [-0.42, 0.05, row.z] as [number, number, number],
    side: -1 as const,
    forwardBiasDeg: row.forwardBiasDeg,
    phase: i * 0.9 + 0.5,
    isFront: i === 0,
    color: BODY_COLOR,
  },
]);

export function Spider() {
  const groupRef = useRef<THREE.Group>(null);
  const headRef = useRef<THREE.Group>(null);
  const fangRefs = [useRef<THREE.Mesh>(null), useRef<THREE.Mesh>(null)];

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    const pulse = attackPulse(t);
    const idleBob = Math.sin(t * 0.9) * 0.06;

    if (groupRef.current) {
      // Crouch-and-lunge: dips slightly before the strike register (small
      // negative pulse window is already flattened to 0 by attackPulse, so
      // this reads mostly as a forward-and-up thrust toward the viewer).
      groupRef.current.position.y = idleBob + pulse * 0.16;
      groupRef.current.position.z = pulse * 0.55;
      const s = 1 + pulse * 0.05;
      groupRef.current.scale.set(s, s, s);
    }
    if (headRef.current) {
      headRef.current.rotation.x = THREE.MathUtils.degToRad(-10 * pulse);
    }
    fangRefs.forEach((ref, i) => {
      if (!ref.current) return;
      const side = i === 0 ? -1 : 1;
      ref.current.position.x = side * (0.12 + pulse * 0.05);
      ref.current.rotation.z = side * pulse * -0.35;
    });
  });

  return (
    <group ref={groupRef}>
      {LEGS.map((leg, i) => (
        <Leg key={i} {...leg} />
      ))}

      {/* abdomen */}
      <mesh position={[0, 0, -0.35]} scale={[1, 0.88, 1.15]}>
        <sphereGeometry args={[0.85, 24, 18]} />
        <meshStandardMaterial color={BODY_COLOR} flatShading roughness={0.55} />
        <Outlines thickness={4} color={INK} />
      </mesh>

      {/* cephalothorax / head */}
      <group ref={headRef} position={[0, 0.12, 0.62]}>
        <mesh scale={[1, 0.95, 1]}>
          <sphereGeometry args={[0.5, 20, 16]} />
          <meshStandardMaterial color={HEAD_COLOR} flatShading roughness={0.55} />
          <Outlines thickness={4} color={INK} />
        </mesh>

        {/* eyes */}
        {[-1, 1].map((side) => (
          <group key={side} position={[side * 0.22, 0.2, 0.38]}>
            <mesh>
              <sphereGeometry args={[0.16, 16, 16]} />
              <meshStandardMaterial color="#ffffff" flatShading />
              <Outlines thickness={3} color={INK} />
            </mesh>
            <mesh position={[side * 0.03, 0, 0.13]}>
              <sphereGeometry args={[0.07, 12, 12]} />
              <meshStandardMaterial color={INK} />
            </mesh>
          </group>
        ))}

        {/* fangs */}
        <mesh
          ref={fangRefs[0]}
          position={[-0.12, -0.24, 0.43]}
          rotation={[Math.PI, 0, 0]}
        >
          <coneGeometry args={[0.06, 0.22, 8]} />
          <meshStandardMaterial color="#f4f1f8" flatShading />
          <Outlines thickness={2.5} color={INK} />
        </mesh>
        <mesh
          ref={fangRefs[1]}
          position={[0.12, -0.24, 0.43]}
          rotation={[Math.PI, 0, 0]}
        >
          <coneGeometry args={[0.06, 0.22, 8]} />
          <meshStandardMaterial color="#f4f1f8" flatShading />
          <Outlines thickness={2.5} color={INK} />
        </mesh>
      </group>
    </group>
  );
}
