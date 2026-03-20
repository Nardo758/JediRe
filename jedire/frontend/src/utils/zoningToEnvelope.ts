import type { ZoningEnvelope } from '@/types/design/design3d.types';

export function zoningProfileToEnvelope(
  profile: any,
  parcelArea?: number
): ZoningEnvelope | null {
  if (!profile) return null;

  const maxHeight =
    profile.max_height ||
    profile.maxHeight ||
    profile.height_limit ||
    profile.heightLimit ||
    100;

  const far =
    profile.far ||
    profile.floor_area_ratio ||
    profile.floorAreaRatio ||
    profile.residential_far ||
    2.0;

  const frontSetback =
    profile.front_setback ||
    profile.frontSetback ||
    profile.setbacks?.front ||
    20;
  const rearSetback =
    profile.rear_setback ||
    profile.rearSetback ||
    profile.setbacks?.rear ||
    20;
  const sideSetback =
    profile.side_setback ||
    profile.sideSetback ||
    profile.setbacks?.side ||
    10;

  const buildableArea =
    profile.buildable_area ||
    profile.buildableArea ||
    (parcelArea ? parcelArea * 0.6 : 10000);

  return {
    id: profile.id || `envelope-${Date.now()}`,
    maxHeight,
    setbacks: {
      front: frontSetback,
      rear: rearSetback,
      side: sideSetback,
    },
    floorAreaRatio: far,
    buildableArea,
    wireframe: true,
    color: '#3b82f6',
  };
}
