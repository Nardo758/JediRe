import { Pool } from 'pg';
import { getPool } from '../database/connection';

export interface VisibilityAssessmentInput {
  property_id: string;
  assessment_method?: string;
  assessed_by?: string;

  is_corner?: boolean;
  corner_type?: string;
  intersection_type?: string;
  distance_to_light_feet?: number;

  frontage_feet?: number;
  setback_feet?: number;
  building_stories?: number;
  elevation_vs_street_feet?: number;

  sightline_north_feet?: number;
  sightline_south_feet?: number;
  sightline_east_feet?: number;
  sightline_west_feet?: number;

  obstruction_trees_pct?: number;
  obstruction_buildings_pct?: number;
  obstruction_street_furniture_pct?: number;
  obstruction_parked_cars_pct?: number;
  obstruction_topography_pct?: number;

  has_signage?: boolean;
  signage_size_sq_ft?: number;
  signage_type?: string;
  signage_is_lit?: boolean;
  signage_visible_from_feet?: number;
  max_sign_size_allowed_sq_ft?: number;

  glass_to_wall_ratio?: number;
  interior_visible?: boolean;
  has_window_displays?: boolean;
  window_tint_level?: string;

  entrance_type?: string;
  entrance_setback_feet?: number;
  has_glass_doors?: boolean;
  has_overhang?: boolean;
  entrance_count?: number;
  is_ada_compliant?: boolean;

  facade_condition?: string;
  architectural_distinctiveness?: string;
  color_contrast_vs_neighbors?: string;

  photos?: any[];
  notes?: string;
}

export interface VisibilityScoreResult {
  property_id: string;
  positional_score: number;
  sightline_score: number;
  setback_score: number;
  signage_score: number;
  transparency_score: number;
  entrance_score: number;
  obstruction_penalty: number;
  overall_visibility_score: number;
  visibility_tier: string;
  capture_rate: number;
}

const WEIGHTS = {
  positional: 0.20,
  sightline: 0.15,
  setback: 0.10,
  signage: 0.20,
  transparency: 0.10,
  entrance: 0.10,
  obstruction: 0.15,
};

export class VisibilityScoringService {
  private pool: Pool;

  constructor(pool?: Pool) {
    this.pool = pool || getPool();
  }

  scorePositional(input: VisibilityAssessmentInput): number {
    let score = 50;
    if (input.is_corner) {
      score += 20;
      if (input.corner_type === 'signalized') score += 10;
      else if (input.corner_type === 'stop-sign') score += 5;
    }
    if (input.intersection_type === 'major') score += 10;
    else if (input.intersection_type === 'minor') score += 5;
    if (input.distance_to_light_feet !== undefined) {
      if (input.distance_to_light_feet <= 100) score += 10;
      else if (input.distance_to_light_feet <= 300) score += 5;
    }
    return Math.min(100, Math.max(0, score));
  }

  scoreSightline(input: VisibilityAssessmentInput): number {
    const directions = [
      input.sightline_north_feet,
      input.sightline_south_feet,
      input.sightline_east_feet,
      input.sightline_west_feet,
    ].filter((v): v is number => v !== undefined && v !== null);

    if (directions.length === 0) return 50;

    const avg = directions.reduce((a, b) => a + b, 0) / directions.length;
    if (avg >= 1000) return 100;
    if (avg >= 500) return 80;
    if (avg >= 250) return 60;
    if (avg >= 100) return 40;
    return 20;
  }

  scoreSetback(input: VisibilityAssessmentInput): number {
    let score = 50;
    if (input.frontage_feet !== undefined) {
      if (input.frontage_feet >= 200) score += 20;
      else if (input.frontage_feet >= 100) score += 10;
      else if (input.frontage_feet < 50) score -= 10;
    }
    if (input.setback_feet !== undefined) {
      if (input.setback_feet >= 10 && input.setback_feet <= 30) score += 15;
      else if (input.setback_feet > 30 && input.setback_feet <= 60) score += 10;
      else if (input.setback_feet > 60) score -= 5;
      else if (input.setback_feet < 10) score += 5;
    }
    if (input.elevation_vs_street_feet !== undefined) {
      if (Math.abs(input.elevation_vs_street_feet) <= 3) score += 10;
      else if (Math.abs(input.elevation_vs_street_feet) > 10) score -= 10;
    }
    return Math.min(100, Math.max(0, score));
  }

  scoreSignage(input: VisibilityAssessmentInput): number {
    if (!input.has_signage) return 10;
    let score = 40;
    if (input.signage_is_lit) score += 15;
    if (input.signage_visible_from_feet !== undefined) {
      if (input.signage_visible_from_feet >= 500) score += 20;
      else if (input.signage_visible_from_feet >= 200) score += 10;
      else if (input.signage_visible_from_feet >= 100) score += 5;
    }
    if (input.signage_size_sq_ft !== undefined) {
      if (input.signage_size_sq_ft >= 50) score += 10;
      else if (input.signage_size_sq_ft >= 20) score += 5;
    }
    if (input.signage_type === 'monument') score += 10;
    else if (input.signage_type === 'pylon') score += 8;
    else if (input.signage_type === 'wall') score += 5;
    return Math.min(100, Math.max(0, score));
  }

  scoreTransparency(input: VisibilityAssessmentInput): number {
    let score = 40;
    if (input.glass_to_wall_ratio !== undefined) {
      score += Math.round(input.glass_to_wall_ratio * 30);
    }
    if (input.interior_visible) score += 10;
    if (input.has_window_displays) score += 10;
    if (input.window_tint_level === 'none') score += 5;
    else if (input.window_tint_level === 'light') score += 3;
    else if (input.window_tint_level === 'dark') score -= 5;
    return Math.min(100, Math.max(0, score));
  }

  scoreEntrance(input: VisibilityAssessmentInput): number {
    let score = 50;
    if (input.has_glass_doors) score += 10;
    if (input.has_overhang) score += 5;
    if (input.entrance_count !== undefined && input.entrance_count >= 2) score += 10;
    if (input.is_ada_compliant) score += 5;
    if (input.entrance_type === 'direct-street') score += 15;
    else if (input.entrance_type === 'courtyard') score += 10;
    else if (input.entrance_type === 'recessed') score += 5;
    else if (input.entrance_type === 'below-grade') score -= 10;
    if (input.entrance_setback_feet !== undefined) {
      if (input.entrance_setback_feet <= 10) score += 5;
      else if (input.entrance_setback_feet > 30) score -= 5;
    }
    return Math.min(100, Math.max(0, score));
  }

  calculateObstructionPenalty(input: VisibilityAssessmentInput): number {
    const obstructions = [
      input.obstruction_trees_pct || 0,
      input.obstruction_buildings_pct || 0,
      input.obstruction_street_furniture_pct || 0,
      input.obstruction_parked_cars_pct || 0,
      input.obstruction_topography_pct || 0,
    ];
    const avgObstruction = obstructions.reduce((a, b) => a + b, 0) / obstructions.length;
    return Math.min(100, Math.max(0, Math.round(avgObstruction)));
  }

  calculateCompositeScore(input: VisibilityAssessmentInput): VisibilityScoreResult {
    const positional = this.scorePositional(input);
    const sightline = this.scoreSightline(input);
    const setback = this.scoreSetback(input);
    const signage = this.scoreSignage(input);
    const transparency = this.scoreTransparency(input);
    const entrance = this.scoreEntrance(input);
    const obstructionPenalty = this.calculateObstructionPenalty(input);

    const weightedSum =
      positional * WEIGHTS.positional +
      sightline * WEIGHTS.sightline +
      setback * WEIGHTS.setback +
      signage * WEIGHTS.signage +
      transparency * WEIGHTS.transparency +
      entrance * WEIGHTS.entrance;

    const penaltyFactor = 1 - (obstructionPenalty / 100) * WEIGHTS.obstruction;
    const overall = Math.round(Math.min(100, Math.max(0, weightedSum * penaltyFactor)));
    const tier = this.getTier(overall);

    return {
      property_id: input.property_id,
      positional_score: positional,
      sightline_score: sightline,
      setback_score: setback,
      signage_score: signage,
      transparency_score: transparency,
      entrance_score: entrance,
      obstruction_penalty: obstructionPenalty,
      overall_visibility_score: overall,
      visibility_tier: tier,
      capture_rate: this.calculateCaptureRate(overall),
    };
  }

  getTier(score: number): string {
    if (score >= 80) return 'Excellent';
    if (score >= 60) return 'Good';
    if (score >= 40) return 'Fair';
    return 'Poor';
  }

  calculateCaptureRate(overallScore: number): number {
    const baseRate = 0.05;
    const maxRate = 0.20;
    const rate = baseRate + (overallScore / 100) * (maxRate - baseRate);
    return Math.round(rate * 1000) / 1000;
  }

  async assessProperty(input: VisibilityAssessmentInput): Promise<VisibilityScoreResult> {
    const scores = this.calculateCompositeScore(input);

    await this.pool.query(
      `INSERT INTO property_visibility (
        property_id, assessment_date, assessment_method, assessed_by,
        is_corner, corner_type, intersection_type, distance_to_light_feet,
        frontage_feet, setback_feet, building_stories, elevation_vs_street_feet,
        sightline_north_feet, sightline_south_feet, sightline_east_feet, sightline_west_feet,
        obstruction_trees_pct, obstruction_buildings_pct, obstruction_street_furniture_pct,
        obstruction_parked_cars_pct, obstruction_topography_pct,
        has_signage, signage_size_sq_ft, signage_type, signage_is_lit,
        signage_visible_from_feet, max_sign_size_allowed_sq_ft,
        glass_to_wall_ratio, interior_visible, has_window_displays, window_tint_level,
        entrance_type, entrance_setback_feet, has_glass_doors, has_overhang,
        entrance_count, is_ada_compliant,
        facade_condition, architectural_distinctiveness, color_contrast_vs_neighbors,
        positional_score, sightline_score, setback_score, signage_score,
        transparency_score, entrance_score, obstruction_penalty,
        overall_visibility_score, visibility_tier,
        photos, notes, updated_at
      ) VALUES (
        $1, CURRENT_DATE, $2, $3,
        $4, $5, $6, $7,
        $8, $9, $10, $11,
        $12, $13, $14, $15,
        $16, $17, $18, $19, $20,
        $21, $22, $23, $24, $25, $26,
        $27, $28, $29, $30,
        $31, $32, $33, $34, $35, $36,
        $37, $38, $39,
        $40, $41, $42, $43, $44, $45, $46,
        $47, $48,
        $49, $50, NOW()
      )
      ON CONFLICT (property_id) DO UPDATE SET
        assessment_date = CURRENT_DATE,
        assessment_method = EXCLUDED.assessment_method,
        assessed_by = EXCLUDED.assessed_by,
        is_corner = EXCLUDED.is_corner,
        corner_type = EXCLUDED.corner_type,
        intersection_type = EXCLUDED.intersection_type,
        distance_to_light_feet = EXCLUDED.distance_to_light_feet,
        frontage_feet = EXCLUDED.frontage_feet,
        setback_feet = EXCLUDED.setback_feet,
        building_stories = EXCLUDED.building_stories,
        elevation_vs_street_feet = EXCLUDED.elevation_vs_street_feet,
        sightline_north_feet = EXCLUDED.sightline_north_feet,
        sightline_south_feet = EXCLUDED.sightline_south_feet,
        sightline_east_feet = EXCLUDED.sightline_east_feet,
        sightline_west_feet = EXCLUDED.sightline_west_feet,
        obstruction_trees_pct = EXCLUDED.obstruction_trees_pct,
        obstruction_buildings_pct = EXCLUDED.obstruction_buildings_pct,
        obstruction_street_furniture_pct = EXCLUDED.obstruction_street_furniture_pct,
        obstruction_parked_cars_pct = EXCLUDED.obstruction_parked_cars_pct,
        obstruction_topography_pct = EXCLUDED.obstruction_topography_pct,
        has_signage = EXCLUDED.has_signage,
        signage_size_sq_ft = EXCLUDED.signage_size_sq_ft,
        signage_type = EXCLUDED.signage_type,
        signage_is_lit = EXCLUDED.signage_is_lit,
        signage_visible_from_feet = EXCLUDED.signage_visible_from_feet,
        max_sign_size_allowed_sq_ft = EXCLUDED.max_sign_size_allowed_sq_ft,
        glass_to_wall_ratio = EXCLUDED.glass_to_wall_ratio,
        interior_visible = EXCLUDED.interior_visible,
        has_window_displays = EXCLUDED.has_window_displays,
        window_tint_level = EXCLUDED.window_tint_level,
        entrance_type = EXCLUDED.entrance_type,
        entrance_setback_feet = EXCLUDED.entrance_setback_feet,
        has_glass_doors = EXCLUDED.has_glass_doors,
        has_overhang = EXCLUDED.has_overhang,
        entrance_count = EXCLUDED.entrance_count,
        is_ada_compliant = EXCLUDED.is_ada_compliant,
        facade_condition = EXCLUDED.facade_condition,
        architectural_distinctiveness = EXCLUDED.architectural_distinctiveness,
        color_contrast_vs_neighbors = EXCLUDED.color_contrast_vs_neighbors,
        positional_score = EXCLUDED.positional_score,
        sightline_score = EXCLUDED.sightline_score,
        setback_score = EXCLUDED.setback_score,
        signage_score = EXCLUDED.signage_score,
        transparency_score = EXCLUDED.transparency_score,
        entrance_score = EXCLUDED.entrance_score,
        obstruction_penalty = EXCLUDED.obstruction_penalty,
        overall_visibility_score = EXCLUDED.overall_visibility_score,
        visibility_tier = EXCLUDED.visibility_tier,
        photos = EXCLUDED.photos,
        notes = EXCLUDED.notes,
        updated_at = NOW()`,
      [
        input.property_id,
        input.assessment_method || 'manual',
        input.assessed_by || null,
        input.is_corner ?? false,
        input.corner_type || null,
        input.intersection_type || null,
        input.distance_to_light_feet ?? null,
        input.frontage_feet ?? null,
        input.setback_feet ?? null,
        input.building_stories ?? null,
        input.elevation_vs_street_feet ?? null,
        input.sightline_north_feet ?? null,
        input.sightline_south_feet ?? null,
        input.sightline_east_feet ?? null,
        input.sightline_west_feet ?? null,
        input.obstruction_trees_pct ?? 0,
        input.obstruction_buildings_pct ?? 0,
        input.obstruction_street_furniture_pct ?? 0,
        input.obstruction_parked_cars_pct ?? 0,
        input.obstruction_topography_pct ?? 0,
        input.has_signage ?? false,
        input.signage_size_sq_ft ?? null,
        input.signage_type || null,
        input.signage_is_lit ?? false,
        input.signage_visible_from_feet ?? null,
        input.max_sign_size_allowed_sq_ft ?? null,
        input.glass_to_wall_ratio ?? null,
        input.interior_visible ?? false,
        input.has_window_displays ?? false,
        input.window_tint_level || null,
        input.entrance_type || null,
        input.entrance_setback_feet ?? null,
        input.has_glass_doors ?? false,
        input.has_overhang ?? false,
        input.entrance_count ?? 1,
        input.is_ada_compliant ?? true,
        input.facade_condition || null,
        input.architectural_distinctiveness || null,
        input.color_contrast_vs_neighbors || null,
        scores.positional_score,
        scores.sightline_score,
        scores.setback_score,
        scores.signage_score,
        scores.transparency_score,
        scores.entrance_score,
        scores.obstruction_penalty,
        scores.overall_visibility_score,
        scores.visibility_tier,
        JSON.stringify(input.photos || []),
        input.notes || null,
      ]
    );

    return scores;
  }

  async getScore(propertyId: string): Promise<VisibilityScoreResult | null> {
    const result = await this.pool.query(
      `SELECT property_id, positional_score, sightline_score, setback_score,
              signage_score, transparency_score, entrance_score, obstruction_penalty,
              overall_visibility_score, visibility_tier
       FROM property_visibility WHERE property_id = $1`,
      [propertyId]
    );

    if (result.rows.length === 0) return null;

    const row = result.rows[0];
    return {
      property_id: row.property_id,
      positional_score: row.positional_score,
      sightline_score: row.sightline_score,
      setback_score: row.setback_score,
      signage_score: row.signage_score,
      transparency_score: row.transparency_score,
      entrance_score: row.entrance_score,
      obstruction_penalty: row.obstruction_penalty,
      overall_visibility_score: row.overall_visibility_score,
      visibility_tier: row.visibility_tier,
      capture_rate: this.calculateCaptureRate(row.overall_visibility_score),
    };
  }

  async getFullAssessment(propertyId: string): Promise<any | null> {
    const result = await this.pool.query(
      `SELECT * FROM property_visibility WHERE property_id = $1`,
      [propertyId]
    );
    if (result.rows.length === 0) return null;
    const row = result.rows[0];
    return {
      ...row,
      capture_rate: this.calculateCaptureRate(row.overall_visibility_score),
    };
  }

  async deleteAssessment(propertyId: string): Promise<boolean> {
    const result = await this.pool.query(
      `DELETE FROM property_visibility WHERE property_id = $1`,
      [propertyId]
    );
    return (result.rowCount ?? 0) > 0;
  }
}

export const visibilityScoringService = new VisibilityScoringService();
