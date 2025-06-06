'use client';

import { useState, useEffect, useRef } from 'react';
import { Play, Pause, SkipBack, SkipForward, RotateCcw } from 'lucide-react';

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

interface VideoPlayerProps {
  apiBase: string;
  videoName: string;
  frames: AnalysisResult[];
  currentFrameIndex: number;
  onFrameChange: (frameIndex: number) => void;
}

export default function VideoPlayer({ 
  apiBase, 
  videoName, 
  frames, 
  currentFrameIndex, 
  onFrameChange 
}: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [videoError, setVideoError] = useState(false);
  const [currentAnalysis, setCurrentAnalysis] = useState<AnalysisResult | null>(null);

  // Video source URL
  const videoUrl = `${apiBase}/video/${videoName}`;

  // Update current analysis based on video time (more frequent check)
  useEffect(() => {
    const findCurrentAnalysis = () => {
      // Find the analysis frame that matches current video time (±0.25 seconds for 2fps)
      const matching = frames.find(frame => 
        Math.abs(frame.timestamp - currentTime) < 0.25
      );
      
      if (matching && matching !== currentAnalysis) {
        setCurrentAnalysis(matching);
        const frameIndex = frames.findIndex(f => f.frame_id === matching.frame_id);
        if (frameIndex !== -1 && frameIndex !== currentFrameIndex) {
          onFrameChange(frameIndex);
        }
      }
    };

    findCurrentAnalysis();
  }, [currentTime, frames, currentFrameIndex, onFrameChange, currentAnalysis]);

  // Draw analysis overlay on canvas
  useEffect(() => {
    const drawOverlay = () => {
      const canvas = canvasRef.current;
      const video = videoRef.current;
      
      if (!canvas || !video || video.videoWidth === 0 || video.videoHeight === 0) return;
      
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // Set canvas size to match video element size
      const videoRect = video.getBoundingClientRect();
      canvas.width = video.offsetWidth;
      canvas.height = video.offsetHeight;
      
      // Clear canvas
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      // Only draw if we have current analysis
      if (!currentAnalysis || !currentAnalysis.detected_objects) return;
      
      // Calculate scale factors based on video dimensions vs display size
      const scaleX = canvas.width / video.videoWidth;
      const scaleY = canvas.height / video.videoHeight;
      
      console.log('Drawing overlay:', {
        objects: currentAnalysis.detected_objects.length,
        canvasSize: [canvas.width, canvas.height],
        videoSize: [video.videoWidth, video.videoHeight],
        scale: [scaleX, scaleY]
      });
      
      // Draw bounding boxes for detected objects
      currentAnalysis.detected_objects.forEach((obj, index) => {
        if (!obj.bbox || obj.bbox.length !== 4) return;
        
        const [x1, y1, x2, y2] = obj.bbox;
        
        // Scale coordinates to canvas size
        const scaledX1 = x1 * scaleX;
        const scaledY1 = y1 * scaleY;
        const scaledX2 = x2 * scaleX;
        const scaledY2 = y2 * scaleY;
        
        const width = scaledX2 - scaledX1;
        const height = scaledY2 - scaledY1;
        
        // Skip if box is too small or invalid
        if (width < 5 || height < 5) return;
        
        // Choose color based on object type
        let color = '#00ff00'; // Green default
        if (['person', 'car', 'motorcycle', 'bus', 'truck'].includes(obj.class)) {
          color = '#ff0000'; // Red for critical objects
        } else if (['bicycle', 'traffic light', 'stop sign'].includes(obj.class)) {
          color = '#ffff00'; // Yellow for navigation relevant
        }
        
        // Draw bounding box with thick line
        ctx.strokeStyle = color;
        ctx.lineWidth = 4;
        ctx.strokeRect(scaledX1, scaledY1, width, height);
        
        // Draw label background
        const label = `${obj.class}: ${(obj.confidence * 100).toFixed(0)}%`;
        ctx.font = 'bold 16px Arial';
        const textMetrics = ctx.measureText(label);
        const textHeight = 20;
        
        // Label background
        ctx.fillStyle = color;
        ctx.fillRect(scaledX1, scaledY1 - textHeight - 4, textMetrics.width + 12, textHeight + 4);
        
        // Label text
        ctx.fillStyle = '#000000'; // Black text for better contrast
        ctx.fillText(label, scaledX1 + 6, scaledY1 - 8);
      });
    };

    // Draw immediately and set up resize observer
    drawOverlay();
    
    const resizeObserver = new ResizeObserver(drawOverlay);
    if (videoRef.current) {
      resizeObserver.observe(videoRef.current);
    }
    
    return () => resizeObserver.disconnect();
  }, [currentAnalysis]);

  // Video event handlers
  const handleTimeUpdate = () => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      setDuration(videoRef.current.duration);
    }
  };

  const handlePlay = () => {
    setIsPlaying(true);
  };

  const handlePause = () => {
    setIsPlaying(false);
  };

  const handleVideoError = () => {
    setVideoError(true);
  };

  // Control handlers
  const togglePlayPause = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
    }
  };

  const handleSeek = (seconds: number) => {
    if (videoRef.current) {
      videoRef.current.currentTime = Math.max(0, Math.min(duration, videoRef.current.currentTime + seconds));
    }
  };

  const handleRestart = () => {
    if (videoRef.current) {
      videoRef.current.currentTime = 0;
    }
  };

  const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (videoRef.current && duration) {
      const rect = e.currentTarget.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const clickPercent = clickX / rect.width;
      videoRef.current.currentTime = clickPercent * duration;
    }
  };

  if (videoError) {
    return (
      <div className="h-full flex items-center justify-center bg-gray-700">
        <div className="text-center text-gray-400">
          <div className="text-4xl mb-2">📱</div>
          <div>Failed to load video</div>
          <div className="text-sm mt-1">
            Trying: {videoUrl}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="bg-gray-700 px-4 py-3 border-b border-gray-600">
        <h2 className="text-white font-semibold">🎥 Real-time Video Analysis</h2>
        <p className="text-gray-400 text-sm">
          {currentAnalysis ? currentAnalysis.time_formatted : '00:00'} • 
          {frames.length} analysis points
        </p>
      </div>

      {/* Video Display */}
      <div className="flex-1 bg-black relative">
        {/* Video Element */}
        <video
          ref={videoRef}
          src={videoUrl}
          className="w-full h-full object-contain"
          onTimeUpdate={handleTimeUpdate}
          onLoadedMetadata={handleLoadedMetadata}
          onPlay={handlePlay}
          onPause={handlePause}
          onError={handleVideoError}
          preload="metadata"
        />
        
        {/* Canvas Overlay for Analysis - Fixed positioning */}
        <canvas
          ref={canvasRef}
          className="absolute top-0 left-0 pointer-events-none z-10"
          style={{ 
            width: '100%', 
            height: '100%',
            objectFit: 'contain'
          }}
        />

        {/* Current Analysis Overlay */}
        {currentAnalysis && (
          <div className="absolute top-4 left-4 bg-black bg-opacity-70 text-white px-3 py-2 rounded-lg text-sm max-w-md">
            <div className="font-semibold mb-1">Scene Analysis:</div>
            <div className="text-xs leading-relaxed">
              {currentAnalysis.text_analysis}
            </div>
          </div>
        )}

        {/* Playback Status */}
        <div className="absolute bottom-4 right-4">
          <div className={`px-3 py-1 rounded-full text-sm flex items-center ${
            isPlaying ? 'bg-green-600' : 'bg-gray-600'
          } text-white`}>
            {isPlaying ? <Play size={16} className="mr-1" /> : <Pause size={16} className="mr-1" />}
            {isPlaying ? 'Playing' : 'Paused'}
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="bg-gray-700 px-4 py-3 border-t border-gray-600">
        {/* Progress Bar */}
        <div className="mb-4">
          <div 
            className="w-full bg-gray-600 rounded-full h-2 cursor-pointer"
            onClick={handleProgressClick}
          >
            <div
              className="bg-blue-600 h-2 rounded-full transition-all duration-100"
              style={{
                width: duration ? `${(currentTime / duration) * 100}%` : '0%'
              }}
            />
          </div>
          <div className="flex justify-between text-xs text-gray-400 mt-1">
            <span>{Math.floor(currentTime / 60)}:{Math.floor(currentTime % 60).toString().padStart(2, '0')}</span>
            <span>{Math.floor(duration / 60)}:{Math.floor(duration % 60).toString().padStart(2, '0')}</span>
          </div>
        </div>

        {/* Control Buttons */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <button
              onClick={handleRestart}
              className="p-2 rounded-lg bg-gray-600 text-white hover:bg-gray-500"
            >
              <RotateCcw size={20} />
            </button>

            <button
              onClick={() => handleSeek(-10)}
              className="p-2 rounded-lg bg-gray-600 text-white hover:bg-gray-500"
            >
              <SkipBack size={20} />
            </button>

            <button
              onClick={togglePlayPause}
              className="p-3 rounded-lg bg-blue-600 text-white hover:bg-blue-500"
            >
              {isPlaying ? <Pause size={24} /> : <Play size={24} />}
            </button>

            <button
              onClick={() => handleSeek(10)}
              className="p-2 rounded-lg bg-gray-600 text-white hover:bg-gray-500"
            >
              <SkipForward size={20} />
            </button>
          </div>

          {/* Analysis Points Indicator */}
          <div className="text-gray-300 text-sm">
            Analysis at 2fps • {frames.length} points
          </div>
        </div>

        {/* Analysis Timeline */}
        <div className="mt-3">
          <div className="flex space-x-1 overflow-x-auto">
            {frames.map((frame, index) => (
              <button
                key={frame.frame_id}
                onClick={() => {
                  if (videoRef.current) {
                    videoRef.current.currentTime = frame.timestamp;
                  }
                }}
                className={`flex-shrink-0 px-2 py-1 rounded text-xs transition-all ${
                  currentAnalysis?.frame_id === frame.frame_id
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-600 text-gray-300 hover:bg-gray-500'
                }`}
              >
                {frame.time_formatted}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}