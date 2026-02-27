import React from 'react';
import { Message } from '../../stores/chatStore';

interface ChatMessageProps {
  message: Message;
}

export function ChatMessage({ message }: ChatMessageProps) {
  const isAgent = message.role === 'agent';
  const isSystem = message.role === 'system';

  if (isSystem) {
    return (
      <div className="flex justify-center my-2">
        <span className="text-xs text-gray-500 bg-gray-100 px-3 py-1 rounded-full">
          {message.content}
        </span>
      </div>
    );
  }

  return (
    <div className={`flex ${isAgent ? 'justify-start' : 'justify-end'} mb-4`}>
      <div className={`flex max-w-[80%] ${isAgent ? 'flex-row' : 'flex-row-reverse'} gap-2`}>
        {/* Avatar */}
        {isAgent && (
          <div className="flex-shrink-0">
            <div className="h-8 w-8 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center">
              <span className="text-white text-sm font-semibold">🤖</span>
            </div>
          </div>
        )}

        <div className="flex flex-col">
          {/* Agent name */}
          {isAgent && message.agent_name && (
            <div className="text-xs text-gray-500 mb-1 ml-1">
              {message.agent_name}
            </div>
          )}

          {/* Message bubble */}
          <div
            className={`rounded-lg px-4 py-2 ${
              isAgent
                ? 'bg-white border border-gray-200 text-gray-900'
                : 'bg-gradient-to-r from-blue-500 to-blue-600 text-white'
            }`}
          >
            <p className="text-sm whitespace-pre-wrap">{message.content}</p>
          </div>

          {/* Timestamp */}
          <div className={`text-xs text-gray-400 mt-1 ${isAgent ? 'ml-1' : 'mr-1'}`}>
            {new Date(message.created_at).toLocaleTimeString()}
          </div>
        </div>
      </div>
    </div>
  );
}
