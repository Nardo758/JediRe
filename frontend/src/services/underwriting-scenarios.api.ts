/**
 * Underwriting Scenarios API Client — M40 Phase 2
 *
 * Thin wrapper over the REST endpoints defined in
 * backend/src/api/rest/underwriting-scenarios.routes.ts
 */

import { apiClient } from './api.client';

export interface UWScenario {
  id: string;
  deal_id: string;
  name: string;
  description: string | null;
  created_by: 'agent' | 'user';
  created_by_user_id: string | null;
  created_by_agent_run_id: string | null;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
  deleted_at: string | null;
  is_active: boolean;
  parent_id: string | null;
  primary_snapshot_id: string | null;
  year1: Record<string, unknown>;
  tags: string[] | null;
  notes: string | null;
}

export interface ScenarioListResponse {
  success: boolean;
  data: {
    scenarios: UWScenario[];
    count: number;
  };
}

export interface ScenarioDiff {
  scenario_a_id: string;
  scenario_b_id: string;
  computed_at: string;
  field_diffs: Array<{
    field_path: string;
    scenario_a_value: number | null;
    scenario_b_value: number | null;
    delta_absolute: number;
    delta_pct: number | null;
    resolution_a: string;
    resolution_b: string;
    significance: 'major' | 'minor' | 'trivial';
  }>;
  summary: {
    fields_with_changes: number;
    fields_unchanged: number;
    materially_different: number;
    a_higher: number;
    a_lower: number;
  };
}

export async function listScenarios(
  dealId: string,
  filters?: { status?: 'active' | 'archived'; created_by?: 'agent' | 'user' }
): Promise<UWScenario[]> {
  const params = new URLSearchParams();
  if (filters?.status) params.set('status', filters.status);
  if (filters?.created_by) params.set('created_by', filters.created_by);
  const qs = params.toString();
  const res = await apiClient.get<ScenarioListResponse>(
    `/api/v1/deals/${dealId}/underwriting-scenarios${qs ? '?' + qs : ''}`
  );
  return res.data?.data?.scenarios ?? [];
}

export async function getActiveScenario(dealId: string): Promise<UWScenario | null> {
  const res = await apiClient.get<{ success: boolean; data: { scenario: UWScenario } }>(
    `/api/v1/deals/${dealId}/underwriting-scenarios/active`
  );
  return res.data?.data?.scenario ?? null;
}

export async function getScenario(dealId: string, scenarioId: string): Promise<UWScenario | null> {
  const res = await apiClient.get<{ success: boolean; data: { scenario: UWScenario } }>(
    `/api/v1/deals/${dealId}/underwriting-scenarios/${scenarioId}`
  );
  return res.data?.data?.scenario ?? null;
}

export async function createScenario(
  dealId: string,
  input: { name: string; description?: string | null; tags?: string[] | null; source_scenario_id?: string | null }
): Promise<UWScenario> {
  const res = await apiClient.post<{ success: boolean; data: { scenario: UWScenario } }>(
    `/api/v1/deals/${dealId}/underwriting-scenarios`,
    input
  );
  return res.data!.data.scenario;
}

export async function activateScenario(dealId: string, scenarioId: string): Promise<UWScenario> {
  const res = await apiClient.patch<{ success: boolean; data: { scenario: UWScenario } }>(
    `/api/v1/deals/${dealId}/underwriting-scenarios/${scenarioId}/activate`
  );
  return res.data!.data.scenario;
}

export async function updateScenarioMeta(
  dealId: string,
  scenarioId: string,
  input: { name?: string; description?: string | null; tags?: string[] | null; notes?: string | null }
): Promise<UWScenario> {
  const res = await apiClient.patch<{ success: boolean; data: { scenario: UWScenario } }>(
    `/api/v1/deals/${dealId}/underwriting-scenarios/${scenarioId}/meta`,
    input
  );
  return res.data!.data.scenario;
}

export async function archiveScenario(dealId: string, scenarioId: string): Promise<UWScenario> {
  const res = await apiClient.patch<{ success: boolean; data: { scenario: UWScenario } }>(
    `/api/v1/deals/${dealId}/underwriting-scenarios/${scenarioId}/archive`
  );
  return res.data!.data.scenario;
}

export async function restoreScenario(dealId: string, scenarioId: string): Promise<UWScenario> {
  const res = await apiClient.patch<{ success: boolean; data: { scenario: UWScenario } }>(
    `/api/v1/deals/${dealId}/underwriting-scenarios/${scenarioId}/restore`
  );
  return res.data!.data.scenario;
}

export async function deleteScenario(dealId: string, scenarioId: string): Promise<void> {
  await apiClient.delete(`/api/v1/deals/${dealId}/underwriting-scenarios/${scenarioId}`);
}

export async function computeScenarioDiff(
  dealId: string,
  aId: string,
  bId: string
): Promise<ScenarioDiff> {
  const res = await apiClient.get<{ success: boolean; data: { diff: ScenarioDiff } }>(
    `/api/v1/deals/${dealId}/underwriting-scenarios/diff?a=${aId}&b=${bId}`
  );
  return res.data!.data.diff;
}
