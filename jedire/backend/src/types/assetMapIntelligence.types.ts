/**
 * Asset Map Intelligence System - TypeScript Type Definitions
 * Covers news linking, notes, replies, categories, permissions, and spatial data
 */

// ============================================================================
// Common Types
// ============================================================================

export interface Location {
  lat: number;
  lng: number;
}

export interface GeoJSONGeometry {
  type: 'Point' | 'Polygon' | 'LineString' | 'MultiPoint' | 'MultiPolygon' | 'MultiLineString';
  coordinates: number[] | number[][] | number[][][];
}

// ============================================================================
// Asset News Links
// ============================================================================

export type NewsLinkType = 'auto' | 'manual' | 'dismissed';

export interface AssetNewsLink {
  id: string;
  assetId: string;
  newsEventId: string;
  linkType: NewsLinkType;
  distanceMiles: number | null;
  impactScore: number | null; // 1-10
  userNotes: string | null;
  linkedBy: string | null;
  linkedAt: Date;
  dismissedBy: string | null;
  dismissedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateAssetNewsLinkInput {
  assetId: string;
  newsEventId: string;
  linkType: NewsLinkType;
  distanceMiles?: number;
  impactScore?: number;
  userNotes?: string;
  linkedBy?: string;
}

export interface UpdateAssetNewsLinkInput {
  userNotes?: string;
  impactScore?: number;
}

export interface AssetNewsLinkWithEvent extends AssetNewsLink {
  newsEvent: {
    id: string;
    title: string;
    date: Date;
    type: string;
    location: Location | null;
    description?: string;
  };
}

// ============================================================================
// Note Categories
// ============================================================================

export interface NoteCategory {
  id: string;
  userId: string | null;
  organizationId: string | null;
  name: string;
  color: string; // Hex color code
  icon: string; // Emoji or icon name
  isSystemDefault: boolean;
  displayOrder: number;
  createdAt: Date;
}

export interface CreateNoteCategoryInput {
  name: string;
  color?: string;
  icon?: string;
  userId?: string;
  organizationId?: string;
}

export interface UpdateNoteCategoryInput {
  name?: string;
  color?: string;
  icon?: string;
  displayOrder?: number;
}

// ============================================================================
// Asset Notes
// ============================================================================

export type NoteType = 'location' | 'general' | 'annotation';

export interface Attachment {
  type: 'photo' | 'pdf' | 'document' | 'spreadsheet';
  url: string;
  name: string;
  size: number; // bytes
  mimeType?: string;
  uploadedAt?: Date;
}

export interface AssetNote {
  id: string;
  assetId: string;
  noteType: NoteType;
  title: string | null;
  content: string; // Max 5,000 characters
  categoryId: string | null;
  location: Location | null; // For location notes
  geometry: GeoJSONGeometry | null; // For annotation notes
  attachments: Attachment[];
  totalAttachmentSizeBytes: number;
  replyCount: number;
  lastReplyAt: Date | null;
  authorId: string;
  createdAt: Date;
  updatedAt: Date;
  isPrivate: boolean;
}

export interface CreateAssetNoteInput {
  assetId: string;
  noteType: NoteType;
  title?: string;
  content: string;
  categoryId?: string;
  location?: Location;
  geometry?: GeoJSONGeometry;
  isPrivate?: boolean;
  authorId: string;
}

export interface UpdateAssetNoteInput {
  title?: string;
  content?: string;
  categoryId?: string;
  location?: Location;
  geometry?: GeoJSONGeometry;
  isPrivate?: boolean;
}

export interface AssetNoteWithAuthor extends AssetNote {
  author: {
    id: string;
    name: string;
    email: string;
    avatar?: string;
  };
  category?: NoteCategory;
}

export interface GetNotesFilters {
  assetId: string;
  type?: NoteType;
  categoryId?: string;
  authorId?: string;
  isPrivate?: boolean;
  limit?: number;
  offset?: number;
}

// ============================================================================
// Note Replies
// ============================================================================

export interface NoteReply {
  id: string;
  noteId: string;
  content: string; // Max 5,000 characters
  authorId: string;
  createdAt: Date;
  updatedAt: Date;
  isEdited: boolean;
}

export interface CreateNoteReplyInput {
  noteId: string;
  content: string;
  authorId: string;
}

export interface UpdateNoteReplyInput {
  content: string;
}

export interface NoteReplyWithAuthor extends NoteReply {
  author: {
    id: string;
    name: string;
    email: string;
    avatar?: string;
  };
}

// ============================================================================
// Asset Note Permissions
// ============================================================================

export type NotePermissionLevel = 'view' | 'edit' | 'admin';

export interface AssetNotePermission {
  id: string;
  assetId: string;
  userId: string;
  permission: NotePermissionLevel;
  grantedBy: string;
  grantedAt: Date;
}

export interface CreateAssetNotePermissionInput {
  assetId: string;
  userId: string;
  permission: NotePermissionLevel;
  grantedBy: string;
}

export interface UpdateAssetNotePermissionInput {
  permission: NotePermissionLevel;
}

export interface AssetNotePermissionWithUser extends AssetNotePermission {
  user: {
    id: string;
    name: string;
    email: string;
  };
}

// ============================================================================
// File Upload
// ============================================================================

export interface FileUploadInput {
  file: Buffer;
  filename: string;
  mimeType: string;
  size: number;
}

export interface FileUploadResult {
  url: string;
  filename: string;
  size: number;
  mimeType: string;
}

export interface FileValidationResult {
  valid: boolean;
  error?: string;
  virusScanPassed?: boolean;
}

// ============================================================================
// API Response Types
// ============================================================================

export interface AssetNewsResponse {
  assetId: string;
  newsEvents: AssetNewsLinkWithEvent[];
  total: number;
  autoLinked: number;
  manualLinked: number;
  dismissed: number;
}

export interface AssetNotesResponse {
  notes: AssetNoteWithAuthor[];
  total: number;
}

export interface NoteRepliesResponse {
  replies: NoteReplyWithAuthor[];
  total: number;
}

export interface NoteCategoriesResponse {
  categories: NoteCategory[];
}

export interface AssetNotePermissionsResponse {
  permissions: AssetNotePermissionWithUser[];
}

// ============================================================================
// Spatial Query Types
// ============================================================================

export interface SpatialQueryOptions {
  radiusMiles?: number;
  boundingBox?: {
    north: number;
    south: number;
    east: number;
    west: number;
  };
}

export interface NewsEventForLinking {
  id: string;
  title: string;
  type: string;
  location: Location;
  impactRadiusMiles: number;
  publishedAt: Date;
}

export interface AssetForLinking {
  id: string;
  name: string;
  location: Location;
}
