export type ProjectType = 'existing' | 'development' | 'redevelopment';

export const PROJECT_TYPE_META: Record<ProjectType, {
  label: string;
  shortLabel: string;
  icon: string;
  description: string;
  sectionCount: number;
}> = {
  existing: {
    label: 'Existing Acquisition',
    shortLabel: 'Existing',
    icon: '🏢',
    description: 'Stabilized or value-add property with in-place tenants',
    sectionCount: 4,
  },
  development: {
    label: 'Ground-Up Development',
    shortLabel: 'Development',
    icon: '🏗️',
    description: 'Vacant land or teardown — new construction',
    sectionCount: 7,
  },
  redevelopment: {
    label: 'Redevelopment',
    shortLabel: 'Redevelopment',
    icon: '🔄',
    description: 'Existing property with renovation or expansion scope',
    sectionCount: 9,
  },
};

export function resolveProjectType(deal: any): ProjectType {
  const raw: string | undefined =
    deal?.project_type || deal?.projectType ||
    deal?.development_type || deal?.developmentType;
  if (!raw) return 'existing';
  const n = raw.toLowerCase().trim();
  if (n === 'existing' || n === 'acquisition') return 'existing';
  if (n === 'development' || n === 'ground-up' || n === 'ground_up') return 'development';
  if (n === 'redevelopment' || n === 'renovation' || n === 'value-add' || n === 'value_add') return 'redevelopment';
  if (n.includes('dev') && !n.includes('redev')) return 'development';
  if (n.includes('redev') || n.includes('renov') || n.includes('expand')) return 'redevelopment';
  return 'existing';
}
