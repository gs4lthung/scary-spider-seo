"use client";

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Outlines } from "@react-three/drei";
import * as THREE from "three";
import { attackPulse } from "./animation";

const UPPER_LENGTH = 0.95;
const LOWER_LENGTH = 0.85;

export type LegConfig = {
  /** Where the leg attaches on the body surface (x should already carry the side's sign). */
  attach: [number, number, number];
  /** 1 = right side, -1 = left side — mirrors the whole leg via negative scale. */
  side: 1 | -1;
  /** How far forward (+) or back (-) this leg points, in degrees (0 = straight out to the side). */
  forwardBiasDeg: number;
  /** Animation phase offset so legs don't wiggle in lockstep. */
  phase: number;
  /** Front pair rears up to strike during the attack pulse; back pairs push off instead. */
  isFront: boolean;
  color: string;
};

export function Leg({
  attach,
  side,
  forwardBiasDeg,
  phase,
  isFront,
  color,
}: LegConfig) {
  const shoulderRef = useRef<THREE.Group>(null);
  const kneeRef = useRef<THREE.Group>(null);

  // Template is authored for the right side (local +X = outward); the parent
  // group's negative scale mirrors it for the left side, so this never
  // depends on `side` itself. Rotating local +X by `yaw` around Y gives a
  // world direction of (cos(yaw), 0, -sin(yaw)) — negative yaw points the
  // leg forward (+Z), positive yaw points it backward (-Z).
  const yawDeg = -forwardBiasDeg;

  useFrame(({ clock }) => {
    const wiggle = Math.sin(clock.elapsedTime * 1.6 + phase) * 0.09;
    const pulse = attackPulse(clock.elapsedTime);
    // Front legs rear up like a strike; back legs dig in and push off.
    const strike = isFront ? pulse * 42 : pulse * -14;
    const strikeBend = isFront ? pulse * -28 : pulse * 12;

    if (shoulderRef.current) {
      shoulderRef.current.rotation.z =
        THREE.MathUtils.degToRad(-16 - strike) + wiggle;
    }
    if (kneeRef.current) {
      kneeRef.current.rotation.z =
        THREE.MathUtils.degToRad(-78 - strikeBend) + wiggle * 1.4;
    }
  });

  return (
    <group position={attach} scale={[side, 1, 1]}>
      <group rotation={[0, THREE.MathUtils.degToRad(yawDeg), 0]}>
        <group ref={shoulderRef} rotation={[0, 0, THREE.MathUtils.degToRad(-16)]}>
          <mesh position={[UPPER_LENGTH / 2, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.09, 0.06, UPPER_LENGTH, 8]} />
            <meshStandardMaterial color={color} flatShading roughness={0.6} />
            <Outlines thickness={3} color="#0b0710" />
          </mesh>

          <group
            ref={kneeRef}
            position={[UPPER_LENGTH, 0, 0]}
            rotation={[0, 0, THREE.MathUtils.degToRad(-78)]}
          >
            <mesh position={[LOWER_LENGTH / 2, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
              <cylinderGeometry args={[0.06, 0.012, LOWER_LENGTH, 8]} />
              <meshStandardMaterial color={color} flatShading roughness={0.6} />
              <Outlines thickness={3} color="#0b0710" />
            </mesh>
          </group>
        </group>
      </group>
    </group>
  );
}
