/**
 * Map Layer Types
 * Type definitions for the layer system
 */

export type LayerType = 'pin' | 'bubble' | 'heatmap' | 'boundary' | 'overlay';
export type SourceType = 'assets' | 'pipeline' | 'email' | 'news' | 'market' | 'custom';

export interface LayerFilters {
  status?: string[];
  propertyType?: string[];
  priceRange?: [number, number];
  dateRange?: [string, string];
  [key: string]: any;
}

export interface PinStyle {
  color?: string;
  icon?: string; // Icon name or emoji
  size?: 'small' | 'medium' | 'large';
  clusterColor?: string;
}

export interface BubbleStyle {
  metric?: string; // Which property to size by
  colorScale?: string[]; // Gradient colors
  minRadius?: number;
  maxRadius?: number;
  strokeColor?: string;
  strokeWidth?: number;
}

export interface HeatmapStyle {
  colorScale?: string[]; // Heat gradient
  radius?: number;
  intensity?: number;
  blur?: number;
}

export interface BoundaryStyle {
  fillColor?: string;
  fillOpacity?: number;
  strokeColor?: string;
  strokeWidth?: number;
  strokeDasharray?: string;
}

export interface OverlayStyle {
  colorScale?: string[]; // Choropleth colors
  valueRanges?: number[]; // Bins for color mapping
  opacity?: number;
}

export type LayerStyle = PinStyle | BubbleStyle | HeatmapStyle | BoundaryStyle | OverlayStyle;

export interface SourceConfig {
  apiEndpoint?: string;
  queryParams?: Record<string, any>;
  refreshInterval?: number;
  cacheEnabled?: boolean;
  [key: string]: any;
}

export interface MapLayer {
  id: string;
  map_id: string;
  name: string;
  layer_type: LayerType;
  source_type: SourceType;
  visible: boolean;
  opacity: number;
  z_index: number;
  filters: LayerFilters;
  style: LayerStyle;
  source_config: SourceConfig;
  created_at: string;
  updated_at: string;
}

// Data point types for each source

export interface PinDataPoint {
  id: string;
  lat: number;
  lng: number;
  label?: string;
  icon?: string;
  color?: string;
  popup?: Record<string, any>;
}

export interface AssetDataPoint extends PinDataPoint {
  address: string;
  property_type: string;
  bedrooms?: number;
  bathrooms?: number;
  sqft?: number;
  price?: number;
}

export interface PipelineDataPoint extends PinDataPoint {
  property_name: string;
  address: string;
  stage_name: string;
  stage_color: string;
  property_data?: Record<string, any>;
}

export interface EmailDataPoint extends PinDataPoint {
  subject: string;
  from_email: string;
  from_name: string;
  address: string;
  received_at: string;
  deal_id?: string;
}

export interface NewsDataPoint extends PinDataPoint {
  event_type: string;
  headline: string;
  summary: string;
  impact_score: number;
  confidence_score: number;
  event_date: string;
}

export type LayerDataPoint = 
  | AssetDataPoint 
  | PipelineDataPoint 
  | EmailDataPoint 
  | NewsDataPoint 
  | PinDataPoint;

// API Request/Response types

export interface CreateLayerRequest {
  map_id: string;
  name: string;
  layer_type: LayerType;
  source_type: SourceType;
  visible?: boolean;
  opacity?: number;
  z_index?: number;
  filters?: LayerFilters;
  style?: LayerStyle;
  source_config?: SourceConfig;
}

export interface UpdateLayerRequest {
  name?: string;
  visible?: boolean;
  opacity?: number;
  z_index?: number;
  filters?: LayerFilters;
  style?: LayerStyle;
  source_config?: SourceConfig;
}

export interface ReorderLayersRequest {
  map_id: string;
  layer_order: Array<{
    id: string;
    z_index: number;
  }>;
}
