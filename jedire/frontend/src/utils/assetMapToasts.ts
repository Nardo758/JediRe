/**
 * Asset Map Toast Notifications Helper
 * Provides consistent toast notifications for real-time events
 */

// This is a placeholder for your toast library
// Replace with your actual toast implementation (react-hot-toast, react-toastify, etc.)

type ToastType = 'info' | 'success' | 'warning' | 'error';

/**
 * Show toast notification
 * Replace this with your actual toast library
 */
function showToast(message: string, type: ToastType = 'info') {
  console.log(`[${type.toUpperCase()}] ${message}`);
  
  // Example with react-hot-toast:
  // import toast from 'react-hot-toast';
  // toast[type](message);
  
  // Example with react-toastify:
  // import { toast } from 'react-toastify';
  // toast[type](message);
}

/**
 * Toast messages for asset map events
 */
export const AssetMapToasts = {
  noteCreated: (authorName: string, title?: string) => {
    const message = title 
      ? `${authorName} added: "${title}"`
      : `${authorName} added a new note`;
    showToast(message, 'info');
  },

  noteUpdated: (authorName: string) => {
    showToast(`${authorName} updated a note`, 'info');
  },

  noteDeleted: () => {
    showToast('A note was deleted', 'warning');
  },

  replyCreated: (authorName: string) => {
    showToast(`${authorName} replied to a note`, 'info');
  },

  replyUpdated: (authorName: string) => {
    showToast(`${authorName} edited a reply`, 'info');
  },

  replyDeleted: () => {
    showToast('A reply was deleted', 'warning');
  },

  newsLinked: (newsTitle?: string) => {
    const message = newsTitle
      ? `New market event: ${newsTitle}`
      : 'New market event linked';
    showToast(message, 'success');
  },

  newsDismissed: () => {
    showToast('Market event dismissed', 'info');
  },

  connected: () => {
    showToast('Connected to real-time updates', 'success');
  },

  disconnected: () => {
    showToast('Disconnected from real-time updates', 'warning');
  },

  reconnected: () => {
    showToast('Reconnected to real-time updates', 'success');
  },

  subscribed: (assetName?: string) => {
    const message = assetName
      ? `Watching ${assetName} for updates`
      : 'Subscribed to asset updates';
    showToast(message, 'info');
  },

  permissionDenied: () => {
    showToast('You don\'t have permission to view this asset', 'error');
  },

  connectionError: () => {
    showToast('Failed to connect to real-time updates', 'error');
  },
};

/**
 * Custom toast with icon
 */
export function showAssetMapToast(
  message: string,
  type: ToastType = 'info',
  icon?: string
) {
  const messageWithIcon = icon ? `${icon} ${message}` : message;
  showToast(messageWithIcon, type);
}

/**
 * Example usage with react-hot-toast:
 * 
 * import toast from 'react-hot-toast';
 * 
 * AssetMapToasts.noteCreated('John Doe', 'Great location!');
 * // Shows: "John Doe added: 'Great location!'"
 * 
 * showAssetMapToast('Custom message', 'success', '🎉');
 * // Shows: "🎉 Custom message"
 */
