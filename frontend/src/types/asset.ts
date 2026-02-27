// Asset Map Intelligence Types

export interface NewsEvent {
  id: string;
  title: string;
  date: string;
  type: 'employment' | 'development' | 'infrastructure' | 'transaction' | 'regulatory' | 'demographic';
  location: {
    lat: number;
    lng: number;
  };
  impactScore?: number;
  description?: string;
  source?: string;
  url?: string;
}

export interface AssetNewsLink {
  id: string;
  assetId: string;
  newsEventId: string;
  linkType: 'auto' | 'manual' | 'dismissed';
  distanceMiles?: number;
  impactScore?: number;
  userNotes?: string;
  linkedBy?: string;
  linkedAt: string;
  dismissedBy?: string;
  dismissedAt?: string;
  newsEvent?: NewsEvent;
}

export type NoteType = 'location' | 'general' | 'annotation';

export interface NoteCategory {
  id: string;
  name: string;
  color: string;
  icon: string;
  isSystemDefault?: boolean;
}

export interface NoteAttachment {
  type: 'photo' | 'file';
  url: string;
  name: string;
  size: number;
}

export interface AssetNote {
  id: string;
  assetId: string;
  noteType: NoteType;
  title?: string;
  content: string;
  category?: NoteCategory;
  categoryId?: string;
  location?: {
    lat: number;
    lng: number;
  };
  geometry?: any;
  attachments: NoteAttachment[];
  totalAttachmentSizeBytes: number;
  replyCount: number;
  lastReplyAt?: string;
  author: {
    id: string;
    name: string;
    avatar?: string;
  };
  authorId: string;
  createdAt: string;
  updatedAt: string;
  isPrivate: boolean;
}

export interface NoteReply {
  id: string;
  noteId: string;
  content: string;
  author: {
    id: string;
    name: string;
    avatar?: string;
  };
  authorId: string;
  createdAt: string;
  updatedAt: string;
  isEdited: boolean;
}

export type NotePermission = 'view' | 'edit' | 'admin';

export interface AssetNotePermission {
  id: string;
  assetId: string;
  userId: string;
  userName: string;
  permission: NotePermission;
  grantedBy: string;
  grantedAt: string;
}

export interface MapViewState {
  center: [number, number];
  zoom: number;
  bounds?: any;
}

export interface MapFilters {
  radiusMiles: 1 | 3 | 5 | 10;
  newsTypes: string[];
  impactLevels: ('high' | 'medium' | 'low')[];
  noteCategories: string[];
  showDismissedNews: boolean;
}

export interface MapLayers {
  propertyBoundary: boolean;
  newsEvents: boolean;
  myNotes: boolean;
  teamNotes: boolean;
  supplyPipeline: boolean;
  comparables: boolean;
}
