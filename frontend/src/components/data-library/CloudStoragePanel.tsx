/**
 * Cloud Storage Panel
 * 
 * Connect to Google Drive, Dropbox, etc. and sync deal folders
 */

import React, { useState, useEffect } from 'react';
import { 
  Cloud, Link, Unlink, FolderOpen, RefreshCw, 
  CheckCircle, AlertCircle, Loader2, ChevronRight, ChevronDown,
  FileText, Download
} from 'lucide-react';
import { 
  cloudStorageService, 
  type CloudProvider, 
  type CloudConnection,
  type CloudFolder,
  type CloudSyncJob
} from '../../services/cloudStorage.service';

interface CloudStoragePanelProps {
  onSyncComplete?: () => void;
}

export const CloudStoragePanel: React.FC<CloudStoragePanelProps> = ({ onSyncComplete }) => {
  const [providers, setProviders] = useState<CloudProvider[]>([]);
  const [connections, setConnections] = useState<CloudConnection[]>([]);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  // Folder browser state
  const [browsingConnection, setBrowsingConnection] = useState<CloudConnection | null>(null);
  const [folders, setFolders] = useState<CloudFolder[]>([]);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [selectedFolder, setSelectedFolder] = useState<CloudFolder | null>(null);
  const [loadingFolders, setLoadingFolders] = useState(false);
  
  // Sync state
  const [syncJob, setSyncJob] = useState<CloudSyncJob | null>(null);
  const [syncing, setSyncing] = useState(false);
  
  useEffect(() => {
    loadData();
    
    // Check URL for connection result
    const params = new URLSearchParams(window.location.search);
    if (params.get('connected')) {
      loadData();
      // Clean up URL
      window.history.replaceState({}, '', window.location.pathname);
    }
    if (params.get('error')) {
      setError(`Connection failed: ${params.get('error')}`);
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);
  
  // Poll sync job status
  useEffect(() => {
    if (!syncJob || ['complete', 'error'].includes(syncJob.status)) return;
    
    const interval = setInterval(async () => {
      try {
        const updated = await cloudStorageService.getSyncJob(syncJob.id);
        setSyncJob(updated);
        
        if (updated.status === 'complete') {
          onSyncComplete?.();
        }
      } catch (err) {
        console.error('Failed to poll sync status:', err);
      }
    }, 2000);
    
    return () => clearInterval(interval);
  }, [syncJob, onSyncComplete]);
  
  const loadData = async () => {
    try {
      setLoading(true);
      const [providersData, connectionsData] = await Promise.all([
        cloudStorageService.getProviders(),
        cloudStorageService.getConnections(),
      ]);
      setProviders(providersData);
      setConnections(connectionsData);
    } catch (err) {
      setError('Failed to load cloud storage data');
    } finally {
      setLoading(false);
    }
  };
  
  const handleConnect = async (provider: CloudProvider) => {
    if (!provider.supported) {
      setError(`${provider.name} integration coming soon`);
      return;
    }
    
    setConnecting(provider.id);
    try {
      const authUrl = await cloudStorageService.connectProvider(provider.id);
      window.location.href = authUrl;
    } catch (err) {
      setError(`Failed to connect to ${provider.name}`);
      setConnecting(null);
    }
  };
  
  const handleDisconnect = async (connection: CloudConnection) => {
    if (!confirm(`Disconnect ${connection.providerName} (${connection.accountEmail})?`)) return;
    
    try {
      await cloudStorageService.disconnectProvider(connection.id);
      setConnections(prev => prev.filter(c => c.id !== connection.id));
      if (browsingConnection?.id === connection.id) {
        setBrowsingConnection(null);
        setFolders([]);
      }
    } catch (err) {
      setError('Failed to disconnect');
    }
  };
  
  const handleBrowse = async (connection: CloudConnection) => {
    setBrowsingConnection(connection);
    setLoadingFolders(true);
    setSelectedFolder(null);
    setExpandedFolders(new Set());
    
    try {
      const rootFolders = await cloudStorageService.browseFolders(connection.id);
      setFolders(rootFolders);
    } catch (err) {
      setError('Failed to load folders');
    } finally {
      setLoadingFolders(false);
    }
  };
  
  const handleExpandFolder = async (folder: CloudFolder) => {
    const newExpanded = new Set(expandedFolders);
    
    if (expandedFolders.has(folder.id)) {
      newExpanded.delete(folder.id);
      setExpandedFolders(newExpanded);
      return;
    }
    
    newExpanded.add(folder.id);
    setExpandedFolders(newExpanded);
    
    // Load children if not already loaded
    if (!folders.some(f => f.parentId === folder.id)) {
      try {
        const children = await cloudStorageService.browseFolders(browsingConnection!.id, folder.id);
        setFolders(prev => [...prev, ...children]);
      } catch (err) {
        console.error('Failed to load subfolders:', err);
      }
    }
  };
  
  const handleStartSync = async () => {
    if (!browsingConnection || !selectedFolder) return;
    
    setSyncing(true);
    try {
      const job = await cloudStorageService.startSync(
        browsingConnection.id,
        selectedFolder.id,
        selectedFolder.path
      );
      setSyncJob(job);
    } catch (err) {
      setError('Failed to start sync');
    } finally {
      setSyncing(false);
    }
  };
  
  const renderFolderTree = (parentId: string | null = null, depth = 0): React.ReactNode => {
    const children = folders.filter(f => f.parentId === parentId);
    if (children.length === 0) return null;
    
    return (
      <div style={{ marginLeft: depth * 16 }}>
        {children.map(folder => {
          const isExpanded = expandedFolders.has(folder.id);
          const isSelected = selectedFolder?.id === folder.id;
          
          return (
            <div key={folder.id}>
              <div
                className={`flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer transition-colors ${
                  isSelected ? 'bg-blue-500/20 text-blue-400' : 'hover:bg-white/5'
                }`}
                onClick={() => setSelectedFolder(folder)}
              >
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleExpandFolder(folder);
                  }}
                  className="p-0.5 hover:bg-white/10 rounded"
                >
                  {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                </button>
                <FolderOpen size={16} className="text-yellow-500" />
                <span className="text-sm truncate">{folder.name}</span>
              </div>
              {isExpanded && renderFolderTree(folder.id, depth + 1)}
            </div>
          );
        })}
      </div>
    );
  };
  
  const getStatusColor = (status: CloudSyncJob['status']) => {
    switch (status) {
      case 'complete': return 'text-green-400';
      case 'error': return 'text-red-400';
      default: return 'text-yellow-400';
    }
  };
  
  const getStatusText = (status: CloudSyncJob['status']) => {
    switch (status) {
      case 'pending': return 'Pending...';
      case 'scanning': return 'Scanning folder...';
      case 'downloading': return 'Downloading files...';
      case 'parsing': return 'Parsing documents...';
      case 'complete': return 'Complete!';
      case 'error': return 'Error';
    }
  };
  
  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="animate-spin text-gray-400" size={24} />
      </div>
    );
  }
  
  return (
    <div className="space-y-6">
      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded px-4 py-3 flex items-center gap-2">
          <AlertCircle size={16} className="text-red-400" />
          <span className="text-sm text-red-300">{error}</span>
          <button onClick={() => setError(null)} className="ml-auto text-red-400 hover:text-red-300">×</button>
        </div>
      )}
      
      {/* Connected Accounts */}
      {connections.length > 0 && (
        <div>
          <h4 className="text-sm font-medium text-gray-300 mb-3">Connected Accounts</h4>
          <div className="space-y-2">
            {connections.map(conn => (
              <div
                key={conn.id}
                className="flex items-center justify-between bg-white/5 rounded px-4 py-3"
              >
                <div className="flex items-center gap-3">
                  <Cloud size={20} className="text-blue-400" />
                  <div>
                    <div className="text-sm font-medium">{conn.providerName}</div>
                    <div className="text-xs text-gray-400">{conn.accountEmail}</div>
                  </div>
                  {conn.isActive ? (
                    <CheckCircle size={14} className="text-green-400" />
                  ) : (
                    <AlertCircle size={14} className="text-yellow-400" />
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleBrowse(conn)}
                    className="px-3 py-1.5 bg-blue-500/20 text-blue-400 rounded text-sm hover:bg-blue-500/30 transition-colors"
                  >
                    <FolderOpen size={14} className="inline mr-1" />
                    Browse
                  </button>
                  <button
                    onClick={() => handleDisconnect(conn)}
                    className="px-3 py-1.5 bg-red-500/10 text-red-400 rounded text-sm hover:bg-red-500/20 transition-colors"
                  >
                    <Unlink size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      
      {/* Connect New Provider */}
      <div>
        <h4 className="text-sm font-medium text-gray-300 mb-3">
          {connections.length > 0 ? 'Connect Another Account' : 'Connect Cloud Storage'}
        </h4>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {providers.map(provider => {
            const isConnected = connections.some(c => c.provider === provider.id);
            const isConnecting = connecting === provider.id;
            
            return (
              <button
                key={provider.id}
                onClick={() => handleConnect(provider)}
                disabled={isConnecting || !provider.supported}
                className={`flex items-center gap-3 px-4 py-3 rounded border transition-all ${
                  provider.supported
                    ? 'border-gray-700 hover:border-gray-500 hover:bg-white/5'
                    : 'border-gray-800 opacity-50 cursor-not-allowed'
                }`}
              >
                <span className="text-2xl">{provider.icon}</span>
                <div className="text-left">
                  <div className="text-sm font-medium">{provider.name}</div>
                  <div className="text-xs text-gray-500">
                    {!provider.supported ? 'Coming soon' : isConnected ? 'Connected' : 'Click to connect'}
                  </div>
                </div>
                {isConnecting && <Loader2 className="animate-spin ml-auto" size={16} />}
              </button>
            );
          })}
        </div>
      </div>
      
      {/* Folder Browser */}
      {browsingConnection && (
        <div className="border border-gray-700 rounded-lg overflow-hidden">
          <div className="bg-gray-800/50 px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Cloud size={16} className="text-blue-400" />
              <span className="text-sm font-medium">{browsingConnection.providerName}</span>
              <span className="text-xs text-gray-500">— {browsingConnection.accountEmail}</span>
            </div>
            <button
              onClick={() => setBrowsingConnection(null)}
              className="text-gray-400 hover:text-white"
            >
              ×
            </button>
          </div>
          
          <div className="p-4">
            {loadingFolders ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="animate-spin text-gray-400" size={20} />
              </div>
            ) : folders.length === 0 ? (
              <div className="text-center py-8 text-gray-500 text-sm">
                No folders found
              </div>
            ) : (
              <div className="max-h-64 overflow-y-auto">
                {renderFolderTree()}
              </div>
            )}
            
            {selectedFolder && (
              <div className="mt-4 pt-4 border-t border-gray-700">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm text-gray-400">Selected folder:</div>
                    <div className="text-sm font-medium">{selectedFolder.path || selectedFolder.name}</div>
                  </div>
                  <button
                    onClick={handleStartSync}
                    disabled={syncing}
                    className="px-4 py-2 bg-green-500 text-white rounded font-medium hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
                  >
                    {syncing ? (
                      <Loader2 className="animate-spin" size={16} />
                    ) : (
                      <Download size={16} />
                    )}
                    Sync to Data Library
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
      
      {/* Sync Progress */}
      {syncJob && (
        <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <RefreshCw 
                size={16} 
                className={syncJob.status === 'complete' || syncJob.status === 'error' ? '' : 'animate-spin'} 
              />
              <span className="text-sm font-medium">Sync Progress</span>
            </div>
            <span className={`text-sm ${getStatusColor(syncJob.status)}`}>
              {getStatusText(syncJob.status)}
            </span>
          </div>
          
          {/* Progress bar */}
          <div className="h-2 bg-gray-700 rounded-full overflow-hidden mb-2">
            <div
              className="h-full bg-blue-500 transition-all duration-300"
              style={{
                width: `${syncJob.totalFiles > 0 ? (syncJob.processedFiles / syncJob.totalFiles) * 100 : 0}%`
              }}
            />
          </div>
          
          <div className="flex items-center justify-between text-xs text-gray-400">
            <span>{syncJob.processedFiles} / {syncJob.totalFiles} files</span>
            <span>{syncJob.successCount} successful, {syncJob.errorCount} errors</span>
          </div>
          
          {syncJob.errors.length > 0 && (
            <div className="mt-3 text-xs text-red-400">
              {syncJob.errors.slice(0, 3).map((err, i) => (
                <div key={i}>• {err}</div>
              ))}
              {syncJob.errors.length > 3 && (
                <div>...and {syncJob.errors.length - 3} more errors</div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
