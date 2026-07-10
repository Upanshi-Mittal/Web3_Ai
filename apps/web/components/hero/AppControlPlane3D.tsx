"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";

const DPR_LIMIT = 1.7;

export function AppControlPlane3D() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [webglUnavailable, setWebglUnavailable] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    if (!supportsWebgl()) {
      setWebglUnavailable(true);
      return undefined;
    }

    const handleContextLost = (event: Event) => {
      event.preventDefault();
      setWebglUnavailable(true);
    };
    canvas.addEventListener("webglcontextlost", handleContextLost, false);

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        canvas,
        antialias: true,
        alpha: true,
        powerPreference: "high-performance"
      });
    } catch {
      setWebglUnavailable(true);
      canvas.removeEventListener("webglcontextlost", handleContextLost);
      return undefined;
    }
    renderer.setClearColor(0x000000, 0);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, DPR_LIMIT));

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(44, 1, 0.1, 100);
    camera.position.set(0, 0.7, 9.8);

    const root = new THREE.Group();
    root.position.set(1.1, -0.05, 0);
    scene.add(root);

    const blockGroup = new THREE.Group();
    root.add(blockGroup);

    const blockMaterial = new THREE.MeshStandardMaterial({
      color: 0x10382d,
      emissive: 0x0f8f69,
      emissiveIntensity: 0.12,
      metalness: 0.35,
      roughness: 0.38
    });
    const hotBlockMaterial = new THREE.MeshStandardMaterial({
      color: 0x6d54d9,
      emissive: 0x7357d9,
      emissiveIntensity: 0.32,
      metalness: 0.3,
      roughness: 0.32
    });
    const blockGeometry = new THREE.BoxGeometry(0.92, 0.52, 0.92);

    const blocks: THREE.Mesh[] = [];
    for (let i = 0; i < 8; i += 1) {
      const mesh = new THREE.Mesh(blockGeometry, i === 4 ? hotBlockMaterial : blockMaterial);
      mesh.position.set(-3.4 + i * 0.82, Math.sin(i * 0.86) * 0.32, -Math.abs(i - 4) * 0.17);
      mesh.rotation.set(0.55, -0.48, 0.15);
      blocks.push(mesh);
      blockGroup.add(mesh);
    }

    const lineMaterial = new THREE.LineBasicMaterial({
      color: 0x39d5a4,
      transparent: true,
      opacity: 0.42
    });
    const railGeometry = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(-4.25, -0.18, -0.7),
      new THREE.Vector3(3.25, 0.25, -0.7)
    ]);
    const rails = Array.from({ length: 4 }, (_, index) => {
      const rail = new THREE.Line(railGeometry, lineMaterial.clone());
      rail.position.y = -0.85 + index * 0.48;
      rail.position.z = -0.35 + index * 0.08;
      root.add(rail);
      return rail;
    });

    const nodeMaterial = new THREE.MeshBasicMaterial({
      color: 0x7ee7bf,
      transparent: true,
      opacity: 0.88
    });
    const dangerMaterial = new THREE.MeshBasicMaterial({
      color: 0xf16d75,
      transparent: true,
      opacity: 0.9
    });
    const nodeGeometry = new THREE.SphereGeometry(0.055, 14, 14);
    const nodes = Array.from({ length: 28 }, (_, index) => {
      const node = new THREE.Mesh(nodeGeometry, index % 9 === 0 ? dangerMaterial : nodeMaterial);
      const angle = index * 1.618;
      const radius = 1.55 + (index % 5) * 0.34;
      node.position.set(Math.cos(angle) * radius + 0.8, Math.sin(index * 0.72) * 1.15, Math.sin(angle) * 0.55 - 0.25);
      root.add(node);
      return node;
    });

    const shieldShape = new THREE.Shape();
    shieldShape.moveTo(0, 1.05);
    shieldShape.lineTo(0.82, 0.72);
    shieldShape.lineTo(0.72, -0.32);
    shieldShape.quadraticCurveTo(0.45, -0.92, 0, -1.16);
    shieldShape.quadraticCurveTo(-0.45, -0.92, -0.72, -0.32);
    shieldShape.lineTo(-0.82, 0.72);
    shieldShape.lineTo(0, 1.05);
    const shield = new THREE.Mesh(
      new THREE.ExtrudeGeometry(shieldShape, { depth: 0.18, bevelEnabled: true, bevelSegments: 2, bevelSize: 0.035, bevelThickness: 0.04 }),
      new THREE.MeshStandardMaterial({
        color: 0x102a21,
        emissive: 0x16a37a,
        emissiveIntensity: 0.24,
        metalness: 0.45,
        roughness: 0.28
      })
    );
    shield.position.set(0.9, 0, 0.95);
    shield.rotation.set(0.03, -0.2, 0);
    root.add(shield);

    const ringMaterial = new THREE.MeshBasicMaterial({
      color: 0x9b7cff,
      transparent: true,
      opacity: 0.34,
      side: THREE.DoubleSide
    });
    const rings = [
      new THREE.Mesh(new THREE.TorusGeometry(1.36, 0.012, 8, 96), ringMaterial),
      new THREE.Mesh(new THREE.TorusGeometry(1.88, 0.01, 8, 96), ringMaterial.clone())
    ];
    rings[0].position.copy(shield.position);
    rings[1].position.copy(shield.position);
    rings[0].rotation.x = Math.PI / 2.2;
    rings[1].rotation.y = Math.PI / 2.5;
    rings.forEach((ring) => root.add(ring));

    const scan = new THREE.Mesh(
      new THREE.PlaneGeometry(6.4, 2.3),
      new THREE.MeshBasicMaterial({
        color: 0x37d4a1,
        transparent: true,
        opacity: 0.12,
        side: THREE.DoubleSide,
        depthWrite: false
      })
    );
    scan.position.set(0.1, 0, 0.35);
    scan.rotation.y = -0.52;
    root.add(scan);

    scene.add(new THREE.AmbientLight(0xeafff6, 1.65));
    const key = new THREE.DirectionalLight(0xcffff0, 2.2);
    key.position.set(4, 5, 6);
    scene.add(key);
    const accent = new THREE.PointLight(0x8b5cf6, 6.5, 12);
    accent.position.set(-2.6, 1.4, 4.5);
    scene.add(accent);

    let frame = 0;
    let raf = 0;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const width = Math.max(1, Math.floor(rect.width));
      const height = Math.max(1, Math.floor(rect.height));
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.position.z = width < 640 ? 11.5 : 9.8;
      root.position.x = width < 640 ? 0.25 : 1.1;
      camera.updateProjectionMatrix();
    };

    const animate = () => {
      frame += reducedMotion ? 0.004 : 0.014;
      root.rotation.y = Math.sin(frame * 0.35) * 0.08;
      blocks.forEach((block, index) => {
        block.position.y += Math.sin(frame + index * 0.7) * 0.0018;
        block.rotation.y += reducedMotion ? 0.001 : 0.004;
      });
      nodes.forEach((node, index) => {
        node.position.y += Math.sin(frame * 1.2 + index) * 0.0016;
        node.scale.setScalar(1 + Math.sin(frame * 1.8 + index) * 0.18);
      });
      rails.forEach((rail, index) => {
        rail.position.x = Math.sin(frame * 0.8 + index) * 0.16;
        (rail.material as THREE.LineBasicMaterial).opacity = 0.22 + Math.abs(Math.sin(frame + index)) * 0.22;
      });
      shield.rotation.y = -0.2 + Math.sin(frame * 0.8) * 0.14;
      rings[0].rotation.z += reducedMotion ? 0.002 : 0.012;
      rings[1].rotation.x += reducedMotion ? 0.001 : 0.007;
      scan.position.x = Math.sin(frame * 1.35) * 2.45;
      (scan.material as THREE.MeshBasicMaterial).opacity = 0.08 + Math.abs(Math.sin(frame * 1.35)) * 0.16;

      renderer.render(scene, camera);
      raf = requestAnimationFrame(animate);
    };

    resize();
    window.addEventListener("resize", resize);
    raf = requestAnimationFrame(animate);

    return () => {
      window.removeEventListener("resize", resize);
      canvas.removeEventListener("webglcontextlost", handleContextLost);
      cancelAnimationFrame(raf);
      blockGeometry.dispose();
      blockMaterial.dispose();
      hotBlockMaterial.dispose();
      railGeometry.dispose();
      rails.forEach((rail) => (rail.material as THREE.Material).dispose());
      nodeGeometry.dispose();
      nodeMaterial.dispose();
      dangerMaterial.dispose();
      shield.geometry.dispose();
      disposeMaterial(shield.material);
      rings.forEach((ring) => {
        ring.geometry.dispose();
        disposeMaterial(ring.material);
      });
      scan.geometry.dispose();
      disposeMaterial(scan.material);
      renderer.dispose();
    };
  }, []);

  if (webglUnavailable) {
    return (
      <div className="relative h-full w-full overflow-hidden" data-testid="app-control-plane-3d-fallback" aria-hidden="true">
        <div className="absolute left-[56%] top-1/2 h-28 w-28 -translate-y-1/2 rotate-45 rounded-xl border border-teal/25 bg-ink/10 shadow-[0_0_70px_rgba(19,138,97,0.22)]" />
        <div className="absolute left-[48%] top-[24%] h-px w-64 rotate-12 bg-teal/25" />
        <div className="absolute left-[44%] top-[58%] h-px w-72 -rotate-6 bg-violet/20" />
        <div className="absolute left-[68%] top-[36%] h-3 w-3 rounded-full bg-teal/40" />
        <div className="absolute left-[76%] top-[52%] h-2 w-2 rounded-full bg-violet/40" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_68%_42%,rgba(19,138,97,0.18),transparent_28%),radial-gradient(circle_at_78%_48%,rgba(115,87,217,0.14),transparent_26%)]" />
      </div>
    );
  }

  return <canvas ref={canvasRef} data-testid="app-control-plane-3d" className="h-full w-full" aria-hidden="true" />;
}

function disposeMaterial(material: THREE.Material | THREE.Material[]) {
  if (Array.isArray(material)) {
    material.forEach((item) => item.dispose());
    return;
  }
  material.dispose();
}

function supportsWebgl() {
  try {
    const probe = document.createElement("canvas");
    return Boolean(probe.getContext("webgl2") || probe.getContext("webgl"));
  } catch {
    return false;
  }
}
