'use client';

import { useEffect, useRef } from 'react';
import { MessageSquare, Clock, Activity } from 'lucide-react';

interface DetectionMessage {
  timestamp: number;
  scene_description: string;
  total_objects: number;
}

interface DetectionMessagesProps {
  messages: DetectionMessage[];
  onTimeClick: (timestamp: number) => void;
  isAnalyzing: boolean;
}

export default function DetectionMessages({ 
  messages, 
  onTimeClick,
  isAnalyzing 
}: DetectionMessagesProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages.length]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="h-96 bg-gray-800 rounded-lg overflow-hidden flex flex-col">
      {/* Header */}
      <div className="bg-gray-700 px-4 py-3 border-b border-gray-600">
        <div className="flex items-center justify-between">
          <h2 className="text-white font-semibold flex items-center">
            <MessageSquare size={20} className="mr-2" />
            Detection Messages
          </h2>
          <div className={`flex items-center text-sm ${isAnalyzing ? 'text-green-400' : 'text-gray-400'}`}>
            <Activity size={16} className={`mr-1 ${isAnalyzing ? 'animate-pulse' : ''}`} />
            {isAnalyzing ? 'Live' : 'Paused'}
          </div>
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4">
        {messages.length === 0 ? (
          <div className="text-gray-500 text-sm text-center py-8">
            Start playing the video to see live detection messages...
          </div>
        ) : (
          <div className="space-y-3">
            {messages.map((msg, index) => (
              <div
                key={index}
                className="bg-gray-700 rounded-lg p-3 hover:bg-gray-600 transition-colors cursor-pointer"
                onClick={() => onTimeClick(msg.timestamp)}
              >
                <div className="flex items-start gap-x-2 justify-start mb-1">
                   <span className="text-gray-200 text-xs">
                    {msg.total_objects} objects: {msg.scene_description}
                  </span>

                  <span className="text-blue-400 text-xs flex items-center">
                    {formatTime(msg.timestamp)}
                  </span>
                 
                </div>
                {/* <p className="text-gray-500 text-sm">
                  {msg.scene_description}
                </p> */}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="bg-gray-700 px-4 py-2 border-t border-gray-600">
        <div className="text-gray-400 text-xs text-center">
          {messages.length} detection messages • Click timestamp to jump
        </div>
      </div>
    </div>
  );
}