"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";

type MeshPoint = {
  position: THREE.Vector3;
  risk: number;
};

const NODE_COUNT = 46;
const LINK_DISTANCE = 3.1;
const DPR_LIMIT = 1.8;

export function HeroThreatMesh3D() {
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
    scene.fog = new THREE.Fog(0xdff7e8, 8, 24);

    const camera = new THREE.PerspectiveCamera(48, 1, 0.1, 100);
    camera.position.set(0, 1.1, 12);

    const group = new THREE.Group();
    scene.add(group);

    const points = createMeshPoints();
    const nodeGeometry = new THREE.SphereGeometry(0.055, 16, 16);
    const nodeMaterial = new THREE.MeshBasicMaterial({ color: 0x16a37a });
    const nodes = new THREE.InstancedMesh(nodeGeometry, nodeMaterial, points.length);
    const matrix = new THREE.Matrix4();
    points.forEach((point, index) => {
      matrix.makeScale(1 + point.risk * 1.6, 1 + point.risk * 1.6, 1 + point.risk * 1.6);
      matrix.setPosition(point.position);
      nodes.setMatrixAt(index, matrix);
    });
    group.add(nodes);

    const linkGeometry = new THREE.BufferGeometry();
    const linkMaterial = new THREE.LineBasicMaterial({
      color: 0x15a77b,
      transparent: true,
      opacity: 0.22
    });
    const links = new THREE.LineSegments(linkGeometry, linkMaterial);
    group.add(links);

    const core = new THREE.Mesh(
      new THREE.IcosahedronGeometry(1.06, 1),
      new THREE.MeshStandardMaterial({
        color: 0x0d3a2e,
        emissive: 0x16a37a,
        emissiveIntensity: 0.28,
        metalness: 0.25,
        roughness: 0.42,
        transparent: true,
        opacity: 0.92
      })
    );
    group.add(core);

    const innerCore = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.56, 0),
      new THREE.MeshStandardMaterial({
        color: 0x7c3aed,
        emissive: 0x7c3aed,
        emissiveIntensity: 0.44,
        metalness: 0.15,
        roughness: 0.35
      })
    );
    group.add(innerCore);

    const ringMaterial = new THREE.MeshBasicMaterial({
      color: 0x37d4a1,
      transparent: true,
      opacity: 0.32,
      side: THREE.DoubleSide
    });
    const rings = [
      new THREE.Mesh(new THREE.TorusGeometry(1.6, 0.012, 8, 96), ringMaterial),
      new THREE.Mesh(new THREE.TorusGeometry(2.15, 0.01, 8, 96), ringMaterial.clone()),
      new THREE.Mesh(new THREE.TorusGeometry(2.72, 0.008, 8, 96), ringMaterial.clone())
    ];
    rings[0].rotation.x = Math.PI / 2.6;
    rings[1].rotation.y = Math.PI / 2.4;
    rings[2].rotation.x = Math.PI / 2;
    rings[2].rotation.z = Math.PI / 7;
    rings.forEach((ring) => group.add(ring));

    const scanMaterial = new THREE.MeshBasicMaterial({
      color: 0x8b5cf6,
      transparent: true,
      opacity: 0.18,
      side: THREE.DoubleSide,
      depthWrite: false
    });
    const scanPlane = new THREE.Mesh(new THREE.PlaneGeometry(7.4, 4.2), scanMaterial);
    scanPlane.rotation.y = -0.42;
    group.add(scanPlane);

    const dangerMaterial = new THREE.MeshBasicMaterial({ color: 0xf97373, transparent: true, opacity: 0.86 });
    const dangerNodes = new THREE.InstancedMesh(new THREE.SphereGeometry(0.075, 16, 16), dangerMaterial, 4);
    points
      .filter((point) => point.risk > 0.74)
      .slice(0, 4)
      .forEach((point, index) => {
        matrix.makeScale(1.6, 1.6, 1.6);
        matrix.setPosition(point.position);
        dangerNodes.setMatrixAt(index, matrix);
      });
    group.add(dangerNodes);

    scene.add(new THREE.AmbientLight(0xffffff, 1.75));
    const key = new THREE.DirectionalLight(0xbdf8df, 2.4);
    key.position.set(4, 6, 7);
    scene.add(key);
    const violet = new THREE.PointLight(0x8b5cf6, 8, 20);
    violet.position.set(-4, 2, 5);
    scene.add(violet);

    let frame = 0;
    let raf = 0;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const width = Math.max(1, Math.floor(rect.width));
      const height = Math.max(1, Math.floor(rect.height));
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.position.z = width < 760 ? 15 : 12;
      camera.updateProjectionMatrix();
    };

    const animate = () => {
      frame += reducedMotion ? 0.004 : 0.012;
      group.rotation.y = Math.sin(frame * 0.42) * 0.18;
      group.rotation.x = -0.08 + Math.sin(frame * 0.31) * 0.04;
      core.rotation.x += reducedMotion ? 0.0015 : 0.006;
      core.rotation.y += reducedMotion ? 0.002 : 0.008;
      innerCore.rotation.y -= reducedMotion ? 0.003 : 0.014;
      innerCore.rotation.z += reducedMotion ? 0.002 : 0.009;
      rings[0].rotation.z += reducedMotion ? 0.002 : 0.009;
      rings[1].rotation.x += reducedMotion ? 0.001 : 0.006;
      rings[2].rotation.y -= reducedMotion ? 0.001 : 0.005;
      scanPlane.position.x = Math.sin(frame * 1.5) * 3.1;
      scanPlane.material.opacity = 0.1 + Math.abs(Math.sin(frame * 1.5)) * 0.14;

      updateLinks(linkGeometry, points, frame);
      renderer.render(scene, camera);
      raf = requestAnimationFrame(animate);
    };

    resize();
    updateLinks(linkGeometry, points, 0);
    window.addEventListener("resize", resize);
    raf = requestAnimationFrame(animate);

    return () => {
      window.removeEventListener("resize", resize);
      canvas.removeEventListener("webglcontextlost", handleContextLost);
      cancelAnimationFrame(raf);
      nodeGeometry.dispose();
      nodeMaterial.dispose();
      linkGeometry.dispose();
      linkMaterial.dispose();
      core.geometry.dispose();
      disposeMaterial(core.material);
      innerCore.geometry.dispose();
      disposeMaterial(innerCore.material);
      rings.forEach((ring) => {
        ring.geometry.dispose();
        disposeMaterial(ring.material);
      });
      scanPlane.geometry.dispose();
      disposeMaterial(scanPlane.material);
      dangerNodes.geometry.dispose();
      dangerMaterial.dispose();
      renderer.dispose();
    };
  }, []);

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      {webglUnavailable ? (
        <div className="h-full w-full" data-testid="hero-threat-mesh-fallback">
          <div className="absolute left-[44%] top-[38%] h-32 w-32 rotate-45 rounded-2xl border border-teal/25 bg-teal/10 shadow-[0_0_90px_rgba(19,138,97,0.24)]" />
          <div className="absolute left-[56%] top-[28%] h-4 w-4 rounded-full bg-teal/30" />
          <div className="absolute left-[68%] top-[47%] h-3 w-3 rounded-full bg-violet/30" />
          <div className="absolute left-[40%] top-[61%] h-px w-96 rotate-12 bg-teal/20" />
          <div className="absolute left-[52%] top-[32%] h-px w-80 -rotate-6 bg-violet/20" />
        </div>
      ) : (
        <canvas ref={canvasRef} data-testid="hero-threat-mesh-canvas" className="h-full w-full" />
      )}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_72%_28%,rgba(124,58,237,0.18),transparent_28%),radial-gradient(circle_at_52%_38%,rgba(20,184,166,0.20),transparent_34%),linear-gradient(90deg,rgba(238,248,241,0.98)_0%,rgba(238,248,241,0.80)_42%,rgba(238,248,241,0.22)_100%)]" />
      <div className="absolute inset-0 mesh-grid opacity-70" />
    </div>
  );
}

function createMeshPoints(): MeshPoint[] {
  return Array.from({ length: NODE_COUNT }, (_, index) => {
    const ring = index % 3;
    const angle = index * 2.399963 + ring * 0.22;
    const radius = 2.4 + ring * 1.05 + ((index * 17) % 11) * 0.08;
    const y = ((index * 29) % 17 - 8) * 0.28;
    const z = ((index * 13) % 19 - 9) * 0.22;
    const risk = ((index * 37) % 100) / 100;
    return {
      position: new THREE.Vector3(Math.cos(angle) * radius, y, Math.sin(angle) * radius * 0.58 + z),
      risk
    };
  });
}

function updateLinks(geometry: THREE.BufferGeometry, points: MeshPoint[], frame: number) {
  const vertices: number[] = [];
  for (let i = 0; i < points.length; i += 1) {
    for (let j = i + 1; j < points.length; j += 1) {
      const distance = points[i].position.distanceTo(points[j].position);
      if (distance < LINK_DISTANCE && (i + j + Math.floor(frame * 6)) % 4 !== 0) {
        vertices.push(
          points[i].position.x,
          points[i].position.y,
          points[i].position.z,
          points[j].position.x,
          points[j].position.y,
          points[j].position.z
        );
      }
    }
  }
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
  geometry.attributes.position.needsUpdate = true;
  geometry.computeBoundingSphere();
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
