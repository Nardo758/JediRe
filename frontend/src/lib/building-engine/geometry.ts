/**
 * ═══════════════════════════════════════════════════════════════════
 * BUILDING GEOMETRY — Three.js mesh generation from parcel footprint
 * ═══════════════════════════════════════════════════════════════════
 *
 * Procedurally generates:
 *   - Extruded building mass
 *   - Floor separation lines
 *   - Window grids on each facade face
 *   - Balconies
 *   - Roof geometry
 */

import * as THREE from 'three';
import type { BuildingParameters, LocalPolygon } from './types';
import { applySetbacks, buildingHeightMeters } from './parcel';
import { getFacadeMaterial, getWindowMaterial, getRoofMaterial } from './materials';

const FEET_TO_METERS = 0.3048;

/**
 * Build a complete Three.js building Group from a parcel polygon + parameters.
 */
export function buildBuildingMesh(
  parcel: LocalPolygon,
  params: BuildingParameters
): THREE.Group {
  const group = new THREE.Group();

  // ── 1. BUILDING FOOTPRINT (with setbacks) ──────────────────────────
  const footprintVertices = applySetbacks(
    parcel,
    params.setbackFront,
    params.setbackRear,
    params.setbackSide
  );

  const shape = new THREE.Shape();
  shape.moveTo(footprintVertices[0][0], footprintVertices[0][1]);
  for (let i = 1; i < footprintVertices.length - 1; i++) {
    shape.lineTo(footprintVertices[i][0], footprintVertices[i][1]);
  }
  shape.closePath();

  const heightM = buildingHeightMeters(params.levels, params.floorHeight);

  // ── 2. MAIN BUILDING MASS ──────────────────────────────────────────
  const extrudeSettings: THREE.ExtrudeGeometryOptions = {
    depth: heightM,
    bevelEnabled: false,
  };

  const buildingGeo = new THREE.ExtrudeGeometry(shape, extrudeSettings);
  // ExtrudeGeometry extrudes along +Z — rotate so Z is up
  buildingGeo.rotateX(-Math.PI / 2);

  const buildingMat = getFacadeMaterial(params.facade);
  const buildingMesh = new THREE.Mesh(buildingGeo, buildingMat);
  buildingMesh.castShadow = true;
  buildingMesh.receiveShadow = true;
  group.add(buildingMesh);

  // ── 3. FLOOR LINES (horizontal bands at each level) ────────────────
  const floorThickness = 0.15; // meters
  for (let i = 1; i < params.levels; i++) {
    const z = i * params.floorHeight * FEET_TO_METERS;
    const floorShape = new THREE.Shape();
    floorShape.moveTo(footprintVertices[0][0], footprintVertices[0][1]);
    for (let j = 1; j < footprintVertices.length - 1; j++) {
      floorShape.lineTo(footprintVertices[j][0], footprintVertices[j][1]);
    }
    floorShape.closePath();

    const floorGeo = new THREE.ExtrudeGeometry(floorShape, {
      depth: floorThickness,
      bevelEnabled: false,
    });
    floorGeo.rotateX(-Math.PI / 2);
    const floorMesh = new THREE.Mesh(floorGeo, new THREE.MeshStandardMaterial({ color: 0x888888 }));
    floorMesh.position.y = z;
    group.add(floorMesh);
  }

  // ── 4. WINDOWS ─────────────────────────────────────────────────────
  if (params.windowRatio > 0) {
    const windows = generateWindows(footprintVertices, params);
    group.add(windows);
  }

  // ── 5. BALCONIES ───────────────────────────────────────────────────
  if (params.balconyDepth > 0) {
    const balconies = generateBalconies(footprintVertices, params);
    group.add(balconies);
  }

  // ── 6. ROOF ────────────────────────────────────────────────────────
  const roof = generateRoof(footprintVertices, heightM, params.roofType);
  if (roof) group.add(roof);

  return group;
}

/**
 * Generate window grids on each facade face.
 */
function generateWindows(
  footprint: [number, number][],
  params: BuildingParameters
): THREE.Group {
  const group = new THREE.Group();
  const winMat = getWindowMaterial();
  const winWidth = 1.2; // meters
  const winHeight = 1.8; // meters
  const spacing = 0.6; // meters between windows
  const floorHeightM = params.floorHeight * FEET_TO_METERS;

  // For each edge of the footprint
  for (let i = 0; i < footprint.length - 1; i++) {
    const [x1, y1] = footprint[i];
    const [x2, y2] = footprint[i + 1];

    const dx = x2 - x1;
    const dy = y2 - y1;
    const edgeLen = Math.sqrt(dx * dx + dy * dy);
    const angle = Math.atan2(dy, dx);

    // Number of windows that fit on this edge
    const unitWidth = winWidth + spacing;
    const numWindows = Math.max(1, Math.floor((edgeLen * params.windowRatio) / unitWidth));
    const actualSpacing = (edgeLen - numWindows * winWidth) / (numWindows + 1);

    for (let floor = 0; floor < params.levels; floor++) {
      const floorZ = floor * floorHeightM + floorHeightM * 0.3; // windows centered vertically on floor

      for (let w = 0; w < numWindows; w++) {
        const x = x1 + Math.cos(angle) * (actualSpacing + w * (winWidth + actualSpacing) + winWidth / 2);
        const y = y1 + Math.sin(angle) * (actualSpacing + w * (winWidth + actualSpacing) + winWidth / 2);

        const winGeo = new THREE.PlaneGeometry(winWidth, winHeight);
        const winMesh = new THREE.Mesh(winGeo, winMat);

        // Position at face, slightly offset to avoid z-fighting
        winMesh.position.set(x, y, floorZ + winHeight / 2);
        winMesh.rotation.z = angle;
        winMesh.rotation.x = -Math.PI / 2; // face outward
        winMesh.translateZ(0.05); // slight offset from facade

        group.add(winMesh);
      }
    }
  }

  return group;
}

/**
 * Generate balconies protruding from each floor on each face.
 */
function generateBalconies(
  footprint: [number, number][],
  params: BuildingParameters
): THREE.Group {
  const group = new THREE.Group();
  const depthM = params.balconyDepth * FEET_TO_METERS;
  const floorHeightM = params.floorHeight * FEET_TO_METERS;
  const balconyMat = new THREE.MeshStandardMaterial({ color: 0xaaaaaa, roughness: 0.7 });

  for (let i = 0; i < footprint.length - 1; i++) {
    const [x1, y1] = footprint[i];
    const [x2, y2] = footprint[i + 1];

    const dx = x2 - x1;
    const dy = y2 - y1;
    const edgeLen = Math.sqrt(dx * dx + dy * dy);
    const angle = Math.atan2(dy, dx);

    // Perpendicular outward direction
    const perpX = -Math.sin(angle);
    const perpY = Math.cos(angle);

    for (let floor = 1; floor < params.levels; floor++) {
      const balconyZ = floor * floorHeightM;

      const balconyShape = new THREE.Shape();
      balconyShape.moveTo(0, 0);
      balconyShape.lineTo(edgeLen, 0);
      balconyShape.lineTo(edgeLen, depthM);
      balconyShape.lineTo(0, depthM);
      balconyShape.closePath();

      const balconyGeo = new THREE.ExtrudeGeometry(balconyShape, {
        depth: 0.15,
        bevelEnabled: false,
      });
      balconyGeo.rotateX(-Math.PI / 2);

      const balconyMesh = new THREE.Mesh(balconyGeo, balconyMat);
      balconyMesh.position.set(x1, y1, balconyZ);
      balconyMesh.rotation.z = angle;
      // Offset so it protrudes outward
      balconyMesh.translateX(0);
      balconyMesh.translateY(0);
      balconyMesh.translateZ(0);

      // Actually we need to shift it outward by the building footprint offset
      // Simpler: just create a thin slab at the right position
      const slabGeo = new THREE.BoxGeometry(edgeLen, depthM, 0.15);
      const slab = new THREE.Mesh(slabGeo, balconyMat);
      slab.position.set(
        (x1 + x2) / 2 + perpX * depthM / 2,
        (y1 + y2) / 2 + perpY * depthM / 2,
        balconyZ + 0.075
      );
      slab.rotation.z = angle;

      group.add(slab);
    }
  }

  return group;
}

/**
 * Generate roof geometry based on type.
 */
function generateRoof(
  footprint: [number, number][],
  buildingHeight: number,
  roofType: string
): THREE.Mesh | null {
  if (roofType === 'flat') {
    // Simple flat roof cap — already covered by top of extrusion
    return null;
  }

  if (roofType === 'pitched') {
    // Create a hip roof by raising the centroid
    const shape = new THREE.Shape();
    shape.moveTo(footprint[0][0], footprint[0][1]);
    for (let i = 1; i < footprint.length - 1; i++) {
      shape.lineTo(footprint[i][0], footprint[i][1]);
    }
    shape.closePath();

    // Centroid of footprint
    let cx = 0,
      cy = 0;
    for (let i = 0; i < footprint.length - 1; i++) {
      cx += footprint[i][0];
      cy += footprint[i][1];
    }
    cx /= footprint.length - 1;
    cy /= footprint.length - 1;

    const roofHeight = 2.5; // meters
    const roofGeo = new THREE.ConeGeometry(3, roofHeight, footprint.length - 1);
    // Not a perfect hip roof — for production we'd use BufferGeometry with custom vertices
    // Simplified: just return null for now and improve later
    return null;
  }

  if (roofType === 'terraced') {
    // Stepped roof with terraces
    const terraceMat = new THREE.MeshStandardMaterial({ color: 0x4a7c59, roughness: 0.9 });
    const group = new THREE.Group();
    // TODO: implement terraced roof
    return null;
  }

  return null;
}
