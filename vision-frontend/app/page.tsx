'use client';

import { useState, useEffect } from 'react';
import VideoPlayer from './components/VideoPlayer';
import AnalysisPanel from './components/AnalysisPanel';
import VideoUpload from './components/VideoUpload';
import { ArrowLeft, RotateCcw } from 'lucide-react';
import axios from 'axios';

interface AnalysisResult {
  frame_id: number;
  timestamp: number;
  time_formatted: string;
  text_analysis: string;
  detected_objects: any[];
  segmented_frame_path: string;
  navigation_summary: {
    people_count: number;
    vehicle_count: number;
    bicycle_count: number;
    total_objects: number;
  };
}

interface SessionData {
  video_name: string;
  total_frames: number;
  analysis_type: string;
  results: AnalysisResult[];
}

type AppState = 'upload' | 'analysis';

export default function Home() {
  const [appState, setAppState] = useState<AppState>('upload');
  const [sessionData, setSessionData] = useState<SessionData | null>(null);
  const [currentFrameIndex, setCurrentFrameIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [currentVideoName, setCurrentVideoName] = useState<string | null>(null);

  const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000';

  // Load analysis results when video analysis is complete
  const loadAnalysisResults = async (videoName: string) => {
    try {
      setIsLoading(true);
      console.log('Loading analysis for:', videoName);
      
      const response = await axios.get(`${API_BASE}/results/${videoName}`);
      setSessionData(response.data);
      setCurrentVideoName(videoName);
      setCurrentFrameIndex(0); // Reset to first frame
      setAppState('analysis'); // Switch to analysis view
      
    } catch (error) {
      console.error('Error loading analysis:', error);
      // Stay on upload screen if loading fails
    } finally {
      setIsLoading(false);
    }
  };

  // Handle when upload and processing is complete
  const handleAnalysisComplete = (videoName: string) => {
    console.log('Analysis complete for video:', videoName);
    loadAnalysisResults(videoName);
  };

  // Handle frame navigation
  const handleFrameChange = (frameIndex: number) => {
    setCurrentFrameIndex(frameIndex);
  };

  const handleTimelineClick = (frameIndex: number) => {
    setCurrentFrameIndex(frameIndex);
  };

  // Return to upload screen
  const handleReturnToUpload = () => {
    setAppState('upload');
    setSessionData(null);
    setCurrentVideoName(null);
    setCurrentFrameIndex(0);
  };

  // Render loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <div className="text-white text-xl">Loading analysis results...</div>
        </div>
      </div>
    );
  }

  // Render upload interface
  if (appState === 'upload') {
    return (
      <div className="min-h-screen bg-gray-900">
        <VideoUpload 
          apiBase={API_BASE}
          onAnalysisComplete={handleAnalysisComplete}
        />
      </div>
    );
  }

  // Render analysis interface
  if (appState === 'analysis' && sessionData) {
    const currentFrame = sessionData.results[currentFrameIndex];

    return (
      <div className="min-h-screen bg-gray-900">
        {/* Header with Back Button */}
        <header className="bg-gray-800 border-b border-gray-700 p-4">
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <button
                onClick={handleReturnToUpload}
                className="flex items-center space-x-2 text-gray-400 hover:text-white transition-colors"
              >
                <ArrowLeft size={20} />
                <span>Upload New Video</span>
              </button>
              
              <div className="h-6 w-px bg-gray-600"></div>
              
              <div>
                <h1 className="text-2xl font-bold text-white">🎥 Video Analysis Results</h1>
                <p className="text-gray-400">
                  {currentVideoName} • {sessionData.total_frames} frames analyzed
                </p>
              </div>
            </div>

            <button
              onClick={() => handleFrameChange(0)}
              className="flex items-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors"
            >
              <RotateCcw size={16} />
              <span>Restart</span>
            </button>
          </div>
        </header>

        {/* Main Content - Split Layout */}
        <div className="max-w-7xl mx-auto p-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-[calc(100vh-140px)]">
            
            {/* Left Side - Video Player */}
            <div className="bg-gray-800 rounded-lg overflow-hidden">
              <VideoPlayer
                apiBase={API_BASE}
                videoName={currentVideoName || sessionData.video_name}
                frames={sessionData.results}
                currentFrameIndex={currentFrameIndex}
                onFrameChange={handleFrameChange}
              />
            </div>

            {/* Right Side - Analysis Panel */}
            <div className="bg-gray-800 rounded-lg overflow-hidden">
              <AnalysisPanel
                results={sessionData.results}
                currentFrameIndex={currentFrameIndex}
                onTimelineClick={handleTimelineClick}
              />
            </div>

          </div>

          {/* Bottom Timeline - Simplified for Video Mode */}
          <div className="mt-6 bg-gray-800 rounded-lg p-4">
            <h3 className="text-white text-lg font-semibold mb-3">Analysis Timeline</h3>
            <div className="text-gray-400 text-sm mb-3">
              Video plays continuously with AI analysis overlays at 2fps (every 0.5 seconds)
            </div>
            <div className="bg-gray-700 rounded-lg p-4">
              <h4 className="text-white font-medium mb-2">How it works:</h4>
              <ul className="text-gray-300 text-sm space-y-1">
                <li>• Video plays normally at full frame rate</li>
                <li>• AI analysis appears as overlays every 0.5 seconds (2fps)</li>
                <li>• Bounding boxes show detected objects in real-time</li>
                <li>• Text descriptions update automatically</li>
              </ul>
            </div>
          </div>

          {/* Video Mode Info */}
          {currentFrame && (
            <div className="mt-4 bg-gray-800 rounded-lg p-6">
              <h3 className="text-white text-lg font-semibold mb-4">Video Analysis Mode</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-gray-700 rounded-lg p-4">
                  <h4 className="text-white font-medium mb-3">📹 Video Features</h4>
                  <ul className="text-gray-300 text-sm space-y-2">
                    <li>• Smooth video playback (full frame rate)</li>
                    <li>• Real-time analysis overlays</li>
                    <li>• Synchronized text descriptions</li>
                    <li>• Click timeline to jump to analysis points</li>
                  </ul>
                </div>
                
                <div className="bg-gray-700 rounded-lg p-4">
                  <h4 className="text-white font-medium mb-3">🤖 AI Analysis</h4>
                  <ul className="text-gray-300 text-sm space-y-2">
                    <li>• Object detection every 0.5 seconds (2fps)</li>
                    <li>• Colored bounding boxes (Red=critical, Yellow=relevant)</li>
                    <li>• Natural language scene descriptions</li>
                    <li>• Perfect for biometric correlation</li>
                  </ul>
                </div>
              </div>
              
              <div className="mt-4 bg-blue-900/20 border border-blue-400/30 rounded-lg p-4">
                <h4 className="text-blue-400 font-medium mb-2">💡 Biometric Integration Ready</h4>
                <p className="text-gray-300 text-sm">
                  This contextual analysis provides the perfect foundation for correlating with biometric data 
                  (heart rate, stress levels, etc.) to understand your physiological responses during different scenarios.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Fallback
  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center">
      <div className="text-white text-xl">Loading...</div>
    </div>
  );
}