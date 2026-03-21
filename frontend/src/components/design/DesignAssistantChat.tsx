/**
 * DesignAssistantChat - Conversational design modification interface
 * Uses LLM to interpret user requests and modify building designs
 */

import React, { useState, useRef, useEffect } from 'react';
import { apiClient } from '@/api/client';
import { useDesign3DStore } from '@/stores/design/design3d.store';
import type { BuildingSection } from '@/types/design/design3d.types';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  modifications?: DesignModification[];
}

interface DesignModification {
  action: 'update_section' | 'add_section' | 'remove_section' | 'regenerate';
  sectionId?: string;
  changes?: {
    geometry?: {
      height?: number;
      floors?: number;
      footprintScale?: number;
    };
    position?: { x?: number; y?: number; z?: number };
    visible?: boolean;
  };
  newSection?: BuildingSection;
  explanation: string;
  alternatives?: Array<{
    description: string;
    modifications: any;
  }>;
}

interface DesignAssistantChatProps {
  onClose: () => void;
}

export const DesignAssistantChat: React.FC<DesignAssistantChatProps> = ({ onClose }) => {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content: '👋 Hi! I\'m your design assistant. I can help you modify the building design. Try asking me to:\n\n• "Add 2 more floors to the residential tower"\n• "Increase parking by 50 spaces"\n• "Make the building 20% taller"\n• "Optimize for more units"',
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [pendingModifications, setPendingModifications] = useState<DesignModification[] | null>(null);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const buildingSections = useDesign3DStore((s) => s.buildingSections);
  const parcelBoundary = useDesign3DStore((s) => s.parcelBoundary);
  const metrics = useDesign3DStore((s) => s.metrics);
  const updateSection = useDesign3DStore((s) => s.updateBuildingSection);
  const addSection = useDesign3DStore((s) => s.addBuildingSection);
  const removeSection = useDesign3DStore((s) => s.removeBuildingSection);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSend = async () => {
    if (!input.trim() || loading) return;

    const userMessage: Message = {
      role: 'user',
      content: input.trim(),
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setLoading(true);

    try {
      // Build design state
      const currentDesign = {
        buildingSections,
        parcelBoundary: parcelBoundary
          ? { area: parcelBoundary.area, areaSF: parcelBoundary.areaSF }
          : undefined,
        metrics,
      };

      // Build conversation history (last 5 messages for context)
      const conversationHistory = messages.slice(-5).map((msg) => ({
        role: msg.role,
        content: msg.content,
      }));

      // Call design assistant API
      const response = await apiClient.post('/design-assistant/chat', {
        userPrompt: userMessage.content,
        currentDesign,
        conversationHistory,
      });

      const { modifications, message: assistantMessage, requiresConfirmation } = response.data;

      const assistantMsg: Message = {
        role: 'assistant',
        content: assistantMessage,
        timestamp: new Date(),
        modifications: modifications || [],
      };

      setMessages((prev) => [...prev, assistantMsg]);

      // If modifications need confirmation, store them
      if (requiresConfirmation && modifications && modifications.length > 0) {
        setPendingModifications(modifications);
      } else if (modifications && modifications.length > 0) {
        // Auto-apply if no confirmation needed
        applyModifications(modifications);
      }
    } catch (error) {
      console.error('[Design Assistant] Error:', error);
      const errorMsg: Message = {
        role: 'assistant',
        content: '❌ Sorry, I encountered an error processing your request. Please try again.',
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const applyModifications = (modifications: DesignModification[]) => {
    try {
      for (const mod of modifications) {
        switch (mod.action) {
          case 'update_section':
            if (mod.sectionId && mod.changes) {
              // Build updates object
              const updates: Partial<BuildingSection> = {};

              if (mod.changes.geometry) {
                const currentSection = buildingSections.find((s) => s.id === mod.sectionId);
                if (currentSection) {
                  updates.geometry = {
                    ...currentSection.geometry,
                    height: mod.changes.geometry.height ?? currentSection.geometry.height,
                    floors: mod.changes.geometry.floors ?? currentSection.geometry.floors,
                  };
                }
              }

              if (mod.changes.position) {
                const currentSection = buildingSections.find((s) => s.id === mod.sectionId);
                if (currentSection) {
                  updates.position = {
                    ...currentSection.position,
                    ...mod.changes.position,
                  };
                }
              }

              if (mod.changes.visible !== undefined) {
                updates.visible = mod.changes.visible;
              }

              updateSection(mod.sectionId, updates);
            }
            break;

          case 'add_section':
            if (mod.newSection) {
              addSection(mod.newSection);
            }
            break;

          case 'remove_section':
            if (mod.sectionId) {
              removeSection(mod.sectionId);
            }
            break;

          case 'regenerate':
            // Would trigger building generator panel
            console.log('[Design Assistant] Regenerate requested');
            break;
        }
      }

      setPendingModifications(null);

      // Confirmation message
      const confirmMsg: Message = {
        role: 'assistant',
        content: '✅ Design updated successfully!',
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, confirmMsg]);
    } catch (error) {
      console.error('[Design Assistant] Error applying modifications:', error);
      const errorMsg: Message = {
        role: 'assistant',
        content: '❌ Failed to apply modifications. Please try again.',
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMsg]);
    }
  };

  const handleApprove = () => {
    if (pendingModifications) {
      applyModifications(pendingModifications);
    }
  };

  const handleReject = () => {
    setPendingModifications(null);
    const rejectMsg: Message = {
      role: 'assistant',
      content: 'Okay, I won\'t make those changes. What else would you like to try?',
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, rejectMsg]);
  };

  return (
    <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-2xl w-full max-w-2xl h-[600px] flex flex-col">
        {/* Header */}
        <div className="flex justify-between items-center px-6 py-4 border-b">
          <div>
            <h2 className="text-xl font-bold">💬 Design Assistant</h2>
            <p className="text-sm text-gray-500">Powered by Claude 3.5 Sonnet</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-2xl"
          >
            ×
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {messages.map((msg, i) => (
            <div
              key={i}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[80%] rounded-lg px-4 py-2 ${
                  msg.role === 'user'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-900'
                }`}
              >
                <div className="whitespace-pre-wrap">{msg.content}</div>
                {msg.modifications && msg.modifications.length > 0 && (
                  <div className="mt-2 pt-2 border-t border-gray-300 text-xs">
                    <div className="font-semibold mb-1">Proposed changes:</div>
                    <ul className="list-disc list-inside space-y-1">
                      {msg.modifications.map((mod, j) => (
                        <li key={j}>{mod.explanation}</li>
                      ))}
                    </ul>
                  </div>
                )}
                <div className="text-xs opacity-70 mt-1">
                  {msg.timestamp.toLocaleTimeString()}
                </div>
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex justify-start">
              <div className="bg-gray-100 rounded-lg px-4 py-2">
                <div className="flex items-center space-x-2">
                  <div className="animate-pulse">●</div>
                  <div className="animate-pulse" style={{ animationDelay: '0.2s' }}>●</div>
                  <div className="animate-pulse" style={{ animationDelay: '0.4s' }}>●</div>
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Pending approval */}
        {pendingModifications && (
          <div className="px-6 py-3 bg-yellow-50 border-t border-yellow-200">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-yellow-900">
                Apply these changes?
              </span>
              <div className="flex gap-2">
                <button
                  onClick={handleReject}
                  className="px-3 py-1 bg-gray-500 hover:bg-gray-600 text-white rounded text-sm"
                >
                  Cancel
                </button>
                <button
                  onClick={handleApprove}
                  className="px-3 py-1 bg-green-600 hover:bg-green-700 text-white rounded text-sm"
                >
                  ✓ Apply
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Input */}
        <div className="px-6 py-4 border-t">
          <div className="flex gap-2">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask me to modify the design..."
              className="flex-1 border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={loading}
            />
            <button
              onClick={handleSend}
              disabled={loading || !input.trim()}
              className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white px-6 py-2 rounded font-medium transition-colors"
            >
              {loading ? '...' : 'Send'}
            </button>
          </div>
          <div className="text-xs text-gray-500 mt-2">
            Press Enter to send • Shift+Enter for new line
          </div>
        </div>
      </div>
    </div>
  );
};
