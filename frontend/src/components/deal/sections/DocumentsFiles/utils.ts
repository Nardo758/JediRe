/**
 * Utility Functions for Documents & Files Module
 */

/**
 * Format file size in human-readable format
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Get icon emoji for file extension
 */
export function getFileIcon(extension: string): string {
  const ext = extension?.toLowerCase().replace('.', '');
  
  const iconMap: Record<string, string> = {
    // Documents
    pdf: '📄',
    doc: '📝',
    docx: '📝',
    txt: '📝',
    
    // Spreadsheets
    xls: '📊',
    xlsx: '📊',
    csv: '📊',
    
    // Presentations
    ppt: '📊',
    pptx: '📊',
    
    // Images
    jpg: '🖼️',
    jpeg: '🖼️',
    png: '🖼️',
    gif: '🖼️',
    webp: '🖼️',
    heic: '🖼️',
    
    // Archives
    zip: '🗜️',
    rar: '🗜️',
    '7z': '🗜️',
    
    // Other
    default: '📎',
  };
  
  return iconMap[ext] || iconMap.default;
}

/**
 * Format date in human-readable format
 */
export function formatDate(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  
  if (diffDays === 0) {
    return 'Today';
  } else if (diffDays === 1) {
    return 'Yesterday';
  } else if (diffDays < 7) {
    return `${diffDays} days ago`;
  } else {
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
    });
  }
}

/**
 * Get category display name
 */
export function getCategoryDisplayName(category: string): string {
  return category
    .replace(/-/g, ' ')
    .replace(/\b\w/g, (l) => l.toUpperCase());
}

/**
 * Get category color class
 */
export function getCategoryColor(category: string): string {
  const colorMap: Record<string, string> = {
    acquisition: 'blue',
    'financial-analysis': 'green',
    'due-diligence': 'yellow',
    'property-info': 'purple',
    correspondence: 'gray',
    financing: 'indigo',
    legal: 'pink',
    financial: 'green',
    leasing: 'teal',
    operations: 'orange',
    'property-media': 'red',
    marketing: 'purple',
    compliance: 'yellow',
    maintenance: 'orange',
    contracts: 'blue',
    reports: 'gray',
    presentations: 'purple',
    photos: 'red',
    other: 'gray',
  };
  
  return colorMap[category] || 'gray';
}
