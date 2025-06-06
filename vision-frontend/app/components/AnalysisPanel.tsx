'use client';

import { useEffect, useRef } from 'react';
import { Users, Car, AlertTriangle, Clock } from 'lucide-react';

interface AnalysisResult {
  frame_id: number;
  timestamp: number;
  time_formatted: string;
  text_analysis: string;
  detected_objects: any[];
  navigation_summary: {
    people_count: number;
    vehicle_count: number;
    bicycle_count: number;
    total_objects: number;
    safety_critical_count?: number;
  };
}

interface AnalysisPanelProps {
  results: AnalysisResult[];
  currentFrameIndex: number;
  onTimelineClick: (frameIndex: number) => void;
}

export default function AnalysisPanel({ 
  results, 
  currentFrameIndex, 
  onTimelineClick 
}: AnalysisPanelProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const currentFrame = results[currentFrameIndex];

  // Auto-scroll to current frame
  useEffect(() => {
    if (scrollRef.current) {
      const currentElement = scrollRef.current.querySelector(`[data-frame-index="${currentFrameIndex}"]`);
      if (currentElement) {
        currentElement.scrollIntoView({ 
          behavior: 'smooth', 
          block: 'center' 
        });
      }
    }
  }, [currentFrameIndex]);

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="bg-gray-700 px-4 py-3 border-b border-gray-600">
        <h2 className="text-white font-semibold">📊 Navigation Analysis</h2>
        <p className="text-gray-400 text-sm">
          First-person perspective • Real-time risk assessment
        </p>
      </div>

      {/* Current Frame Analysis */}
      {currentFrame && (
        <div className="bg-gray-700 p-4 border-b border-gray-600">
          <div className="flex items-start justify-between mb-3">
            <div>
              <h3 className="text-white font-medium">Frame {currentFrame.frame_id + 1}</h3>
              <p className="text-gray-400 text-sm">{currentFrame.time_formatted}</p>
            </div>
            <div className="flex items-center px-2 py-1 rounded border text-blue-400 bg-blue-900/20 border-blue-400/30">
              <Clock size={16} className="text-blue-400" />
              <span className="ml-1 text-sm font-medium">ACTIVE</span>
            </div>
          </div>

          {/* Current Analysis Text */}
          <div className="bg-gray-800 rounded-lg p-3 mb-3">
            <p className="text-gray-300 text-sm leading-relaxed">
              {currentFrame.text_analysis}
            </p>
          </div>
        </div>
      )}

      {/* Full Timeline */}
      <div className="flex-1 overflow-y-auto" ref={scrollRef}>
        <div className="p-4 space-y-3">
          <h3 className="text-white font-medium text-sm mb-3">ANALYSIS TIMELINE</h3>
          
          {results.map((result, index) => (
            <div
              key={result.frame_id}
              data-frame-index={index}
              onClick={() => onTimelineClick(index)}
              className={`cursor-pointer p-3 rounded-lg border transition-all hover:border-gray-500 ${
                index === currentFrameIndex 
                  ? 'bg-blue-900/30 border-blue-400/50' 
                  : 'bg-gray-800 border-gray-600 hover:bg-gray-700'
              }`}
            >
              {/* Header */}
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center space-x-2">
                  <Clock size={14} className="text-gray-400" />
                  <span className="text-white text-sm font-medium">{result.time_formatted}</span>
                </div>
                <div className="flex items-center px-2 py-1 rounded text-xs text-blue-400 bg-blue-900/20 border-blue-400/30">
                  <Clock size={12} className="text-blue-400" />
                  <span className="ml-1">FRAME</span>
                </div>
              </div>

              {/* Analysis Text */}
              <p className={`text-sm leading-relaxed mb-2 ${
                index === currentFrameIndex ? 'text-gray-200' : 'text-gray-400'
              }`}>
                {result.text_analysis}
              </p>

              {/* Quick Metrics - Removed object counts */}
              <div className="flex items-center space-x-4 text-xs text-gray-500">
                <span className="flex items-center">
                  <Clock size={12} className="mr-1" />
                  {result.time_formatted}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Bottom Summary */}
      <div className="bg-gray-700 p-4 border-t border-gray-600">
        <div className="text-center">
          <div className="text-gray-400 text-xs mb-1">SESSION SUMMARY</div>
          <div className="text-white text-sm">
            {results.length} frames analyzed with scene descriptions
          </div>
        </div>
      </div>
    </div>
  );
}