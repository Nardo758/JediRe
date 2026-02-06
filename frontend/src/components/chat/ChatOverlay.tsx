import React, { useState } from 'react';
import { ChatMessage } from './ChatMessage';
import { ChatInput } from './ChatInput';

export function ChatOverlay() {
  const [isOpen, setIsOpen] = useState(true);
  const [isMinimized, setIsMinimized] = useState(false);
  const [messages, setMessages] = useState([
    {
      id: '1',
      type: 'agent' as const,
      content: "Hi! I'm your Chief Orchestrator. I coordinate all specialist agents to help you analyze properties and deals. What would you like to work on?",
      timestamp: new Date().toISOString(),
      agentName: 'Chief Orchestrator'
    }
  ]);

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 w-14 h-14 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-full shadow-lg hover:shadow-xl transition-all flex items-center justify-center text-2xl z-50"
      >
        💬
      </button>
    );
  }

  return (
    <div
      className={`fixed bottom-6 right-6 bg-white rounded-lg shadow-2xl border border-gray-200 z-50 transition-all ${
        isMinimized ? 'w-80 h-14' : 'w-96 h-[600px]'
      }`}
    >
      {/* Chat Header */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-4 py-3 rounded-t-lg flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xl">🤖</span>
          <div>
            <div className="font-semibold">Chief Orchestrator</div>
            <div className="text-xs opacity-90">AI Assistant</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsMinimized(!isMinimized)}
            className="p-1 hover:bg-white/20 rounded"
          >
            {isMinimized ? '□' : '─'}
          </button>
          <button
            onClick={() => setIsOpen(false)}
            className="p-1 hover:bg-white/20 rounded"
          >
            ×
          </button>
        </div>
      </div>

      {!isMinimized && (
        <>
          {/* Chat Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 h-[calc(600px-120px)]">
            {messages.map((message) => (
              <ChatMessage key={message.id} {...message} />
            ))}
            
            {/* Sample property cards */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm">
              <div className="font-semibold text-blue-900 mb-2">
                🏠 3 Properties Found
              </div>
              <div className="space-y-2">
                <div className="bg-white p-2 rounded border border-blue-100">
                  <div className="font-medium">100 Peachtree St</div>
                  <div className="text-xs text-gray-600">$2,100/mo • 2bd 2ba</div>
                </div>
                <div className="bg-white p-2 rounded border border-blue-100">
                  <div className="font-medium">250 Pharr Rd</div>
                  <div className="text-xs text-gray-600">$2,400/mo • 2bd 2ba</div>
                </div>
                <div className="bg-white p-2 rounded border border-blue-100">
                  <div className="font-medium">150 E Paces Ferry</div>
                  <div className="text-xs text-gray-600">$2,800/mo • 3bd 2ba</div>
                </div>
              </div>
            </div>
          </div>

          {/* Chat Input */}
          <div className="border-t border-gray-200">
            <ChatInput onSend={(msg) => {
              setMessages([...messages, {
                id: Date.now().toString(),
                type: 'user',
                content: msg,
                timestamp: new Date().toISOString()
              }]);
            }} />
          </div>
        </>
      )}
    </div>
  );
}
