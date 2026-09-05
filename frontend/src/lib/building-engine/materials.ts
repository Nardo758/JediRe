/**
 * ═══════════════════════════════════════════════════════════════════
 * FACADE MATERIALS — Procedural Three.js materials
 * ═══════════════════════════════════════════════════════════════════
 */

import * as THREE from 'three';
import type { FacadeType } from './types';

/** Standard PBR facade material by type */
export function getFacadeMaterial(type: FacadeType): THREE.MeshStandardMaterial {
  switch (type) {
    case 'brick':
      return new THREE.MeshStandardMaterial({
        color: 0xa0522d,
        roughness: 0.85,
        metalness: 0.0,
      });

    case 'glass':
      return new THREE.MeshStandardMaterial({
        color: 0x88ccff,
        roughness: 0.05,
        metalness: 0.9,
        transparent: true,
        opacity: 0.6,
      });

    case 'concrete':
      return new THREE.MeshStandardMaterial({
        color: 0x999999,
        roughness: 0.95,
        metalness: 0.0,
      });

    case 'wood_panel':
      return new THREE.MeshStandardMaterial({
        color: 0x8b6914,
        roughness: 0.7,
        metalness: 0.0,
      });

    case 'stucco':
      return new THREE.MeshStandardMaterial({
        color: 0xf5f5dc,
        roughness: 0.9,
        metalness: 0.0,
      });

    case 'mixed':
      return new THREE.MeshStandardMaterial({
        color: 0xb0b0b0,
        roughness: 0.6,
        metalness: 0.2,
      });

    default:
      return new THREE.MeshStandardMaterial({ color: 0xcccccc });
  }
}

/** Reflective window material */
export function getWindowMaterial(): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color: 0x224466,
    roughness: 0.1,
    metalness: 0.95,
    emissive: 0x112233,
    emissiveIntensity: 0.2,
  });
}

/** Roof material */
export function getRoofMaterial(): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color: 0x333333,
    roughness: 0.9,
    metalness: 0.1,
  });
}

/** Ground / asphalt material */
export function getGroundMaterial(): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color: 0x444444,
    roughness: 0.95,
    metalness: 0.0,
  });
}

/** Grass / landscaping material */
export function getGrassMaterial(): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color: 0x3d6e3d,
    roughness: 1.0,
    metalness: 0.0,
  });
}
