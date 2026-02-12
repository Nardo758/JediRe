/**
 * Event Cascade Viewer
 * 
 * Visual flow diagram showing event propagation through the system.
 * Displays timeline: News Event → Demand → Supply → JEDI → Pro Forma → Alert
 * 
 * @version 1.0.0
 * @date 2026-02-11
 */

import React, { useState, useEffect } from 'react';
import axios from 'axios';

interface CascadeNode {
  eventId: string;
  topic: string;
  eventType: string;
  publishedAt: string;
  publishedBy: string;
  depth: number;
  parentEventId: string | null;
  processingStatus: string;
  consumerGroup: string;
  consumerName: string;
  errorMessage: string | null;
  durationMs: number | null;
  payload: any;
  children: CascadeNode[];
}

interface EventCascadeViewerProps {
  eventId: string;
  onClose?: () => void;
}

export const EventCascadeViewer: React.FC<EventCascadeViewerProps> = ({ eventId, onClose }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rootEvent, setRootEvent] = useState<any | null>(null);
  const [cascade, setCascade] = useState<CascadeNode[]>([]);
  const [selectedNode, setSelectedNode] = useState<CascadeNode | null>(null);

  useEffect(() => {
    loadCascade();
  }, [eventId]);

  const loadCascade = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`/api/v1/events/trace/${eventId}`);
      setRootEvent(response.data.rootEvent);
      setCascade(response.data.cascade);
      setError(null);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load cascade');
    } finally {
      setLoading(false);
    }
  };

  const getTopicColor = (topic: string): string => {
    const colorMap: Record<string, string> = {
      'news.events.extracted': 'bg-blue-500',
      'signals.demand.updated': 'bg-green-500',
      'signals.supply.updated': 'bg-yellow-500',
      'signals.risk.updated': 'bg-red-500',
      'scores.jedi.updated': 'bg-purple-500',
      'proforma.assumptions.updated': 'bg-indigo-500',
      'alerts.user.generated': 'bg-orange-500',
    };
    return colorMap[topic] || 'bg-gray-500';
  };

  const getStatusIcon = (status: string): string => {
    const iconMap: Record<string, string> = {
      success: '✓',
      processing: '⟳',
      failed: '✗',
      retrying: '↻',
    };
    return iconMap[status] || '?';
  };

  const getStatusColor = (status: string): string => {
    const colorMap: Record<string, string> = {
      success: 'text-green-600',
      processing: 'text-blue-600',
      failed: 'text-red-600',
      retrying: 'text-yellow-600',
    };
    return colorMap[status] || 'text-gray-600';
  };

  const renderNode = (node: CascadeNode, isLast: boolean = false) => {
    const hasChildren = node.children && node.children.length > 0;
    
    return (
      <div key={node.eventId} className="flex flex-col">
        {/* Node */}
        <div className="flex items-center">
          {/* Connection line from parent */}
          {node.depth > 0 && (
            <div className="w-8 h-px bg-gray-300"></div>
          )}
          
          {/* Node box */}
          <div
            onClick={() => setSelectedNode(node)}
            className={`
              relative flex items-center gap-2 p-3 rounded-lg border-2 cursor-pointer
              transition-all hover:shadow-lg
              ${selectedNode?.eventId === node.eventId ? 'border-blue-500 shadow-lg' : 'border-gray-200'}
              ${node.errorMessage ? 'bg-red-50' : 'bg-white'}
            `}
          >
            {/* Topic indicator */}
            <div className={`w-3 h-3 rounded-full ${getTopicColor(node.topic)}`}></div>
            
            {/* Event info */}
            <div className="flex flex-col">
              <div className="font-medium text-sm">{node.eventType}</div>
              <div className="text-xs text-gray-500">{node.topic.split('.')[0]}</div>
            </div>
            
            {/* Status */}
            {node.processingStatus && (
              <div className={`ml-2 text-lg ${getStatusColor(node.processingStatus)}`}>
                {getStatusIcon(node.processingStatus)}
              </div>
            )}
            
            {/* Duration */}
            {node.durationMs && (
              <div className="ml-2 text-xs text-gray-400">
                {node.durationMs}ms
              </div>
            )}
          </div>
          
          {/* Connection line to children */}
          {hasChildren && (
            <div className="w-8 h-px bg-gray-300"></div>
          )}
        </div>
        
        {/* Children */}
        {hasChildren && (
          <div className="ml-12 mt-2 space-y-2">
            {node.children.map((child, index) => 
              renderNode(child, index === node.children.length - 1)
            )}
          </div>
        )}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
        <p className="text-red-700">{error}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-gray-50">
      {/* Header */}
      <div className="flex items-center justify-between p-4 bg-white border-b">
        <div>
          <h2 className="text-lg font-semibold">Event Cascade</h2>
          <p className="text-sm text-gray-500">
            Tracking propagation of event {rootEvent?.eventId.slice(0, 8)}...
          </p>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-600 hover:text-gray-800"
          >
            Close
          </button>
        )}
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Cascade visualization */}
        <div className="flex-1 overflow-auto p-6">
          <div className="space-y-4">
            {cascade.map((node, index) => renderNode(node, index === cascade.length - 1))}
          </div>
        </div>

        {/* Details panel */}
        {selectedNode && (
          <div className="w-96 border-l bg-white overflow-auto p-4">
            <h3 className="font-semibold mb-4">Event Details</h3>
            
            <div className="space-y-4">
              <div>
                <label className="text-xs text-gray-500">Event ID</label>
                <div className="font-mono text-sm">{selectedNode.eventId}</div>
              </div>
              
              <div>
                <label className="text-xs text-gray-500">Topic</label>
                <div className="text-sm">{selectedNode.topic}</div>
              </div>
              
              <div>
                <label className="text-xs text-gray-500">Event Type</label>
                <div className="text-sm">{selectedNode.eventType}</div>
              </div>
              
              <div>
                <label className="text-xs text-gray-500">Published By</label>
                <div className="text-sm">{selectedNode.publishedBy}</div>
              </div>
              
              <div>
                <label className="text-xs text-gray-500">Published At</label>
                <div className="text-sm">
                  {new Date(selectedNode.publishedAt).toLocaleString()}
                </div>
              </div>
              
              {selectedNode.processingStatus && (
                <div>
                  <label className="text-xs text-gray-500">Processing Status</label>
                  <div className={`text-sm ${getStatusColor(selectedNode.processingStatus)}`}>
                    {selectedNode.processingStatus}
                  </div>
                </div>
              )}
              
              {selectedNode.consumerGroup && (
                <div>
                  <label className="text-xs text-gray-500">Consumer</label>
                  <div className="text-sm">
                    {selectedNode.consumerGroup} / {selectedNode.consumerName}
                  </div>
                </div>
              )}
              
              {selectedNode.durationMs && (
                <div>
                  <label className="text-xs text-gray-500">Processing Time</label>
                  <div className="text-sm">{selectedNode.durationMs}ms</div>
                </div>
              )}
              
              {selectedNode.errorMessage && (
                <div>
                  <label className="text-xs text-gray-500">Error</label>
                  <div className="text-sm text-red-600 bg-red-50 p-2 rounded">
                    {selectedNode.errorMessage}
                  </div>
                </div>
              )}
              
              <div>
                <label className="text-xs text-gray-500">Payload</label>
                <pre className="text-xs bg-gray-50 p-2 rounded overflow-auto max-h-96">
                  {JSON.stringify(selectedNode.payload, null, 2)}
                </pre>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default EventCascadeViewer;
