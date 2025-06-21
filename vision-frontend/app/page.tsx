'use client';

import { useState } from 'react';
import VideoUploadPlayer from './components/VideoUploadPlayer';
import DetectionMessages from './components/DetectionMessages';

interface RealtimeAnalysis {
  timestamp: number;
  scene_description: string;
  total_objects: number;
  detected_objects: any[];
}

export default function Home() {
  const [currentVideoId, setCurrentVideoId] = useState<string | null>(null);
  const [analysisHistory, setAnalysisHistory] = useState<RealtimeAnalysis[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const handleVideoUploaded = (videoId: string) => {
    setCurrentVideoId(videoId);
    setAnalysisHistory([]); // Clear previous messages
  };

  const handleAnalysisUpdate = (analysis: RealtimeAnalysis) => {
    setAnalysisHistory(prev => [...prev, analysis]);
  };

  const handleTimeJump = (timestamp: number) => {
    // This will be passed to the video player to jump to timestamp
    const event = new CustomEvent('video-time-jump', { detail: timestamp });
    window.dispatchEvent(event);
  };

  return (
    <div className="min-h-screen bg-gray-900">
      {/* Header */}
      <header className="bg-gray-800 border-b border-gray-700 p-4">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-xl font-bold text-white">Vision Inspector</h1>
          <p className="text-gray-400">
            Upload a video to see live object detection and scene descriptions
          </p>
        </div>
      </header>

      {/* Main Content - Fixed Layout */}
      <div className="max-w-7xl mx-auto p-4">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Video Upload & Player - Takes up 2 columns, fixed height */}
          <div className="lg:col-span-2">
            <div style={{ height: '500px' }}>
              <VideoUploadPlayer
                onVideoUploaded={handleVideoUploaded}
                onAnalysisUpdate={handleAnalysisUpdate}
                onAnalyzingChange={setIsAnalyzing}
              />
            </div>
          </div>

          {/* Detection Messages - Takes up 1 column, fixed height */}
          <div className="lg:col-span-1">
            <DetectionMessages
              messages={analysisHistory}
              onTimeClick={handleTimeJump}
              isAnalyzing={isAnalyzing}
            />
          </div>
        </div>
      </div>
    </div>
  );
}