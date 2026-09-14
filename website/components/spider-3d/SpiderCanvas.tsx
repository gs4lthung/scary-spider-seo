"use client";

import { Canvas } from "@react-three/fiber";
import { ContactShadows } from "@react-three/drei";
import * as THREE from "three";
import { Spider } from "./Spider";

const PRESENTATION_YAW = THREE.MathUtils.degToRad(-25);

export default function SpiderCanvas() {
  return (
    <Canvas
      camera={{ position: [0, 1.1, 4.8], fov: 32 }}
      dpr={[1, 2]}
      gl={{ antialias: true, alpha: true }}
    >
      <ambientLight intensity={0.7} />
      <hemisphereLight intensity={0.5} groundColor="#2a1140" />
      <directionalLight position={[3, 4, 2]} intensity={1.1} />
      <directionalLight position={[-3, 2, -2]} intensity={0.35} color="#c4b5fd" />
      <group rotation={[0, PRESENTATION_YAW, 0]}>
        <Spider />
      </group>
      <ContactShadows
        position={[0, -1.1, 0]}
        opacity={0.45}
        scale={4.5}
        blur={2.6}
        far={2}
      />
    </Canvas>
  );
}
