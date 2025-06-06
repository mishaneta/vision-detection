'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { Upload, Play, Pause, RotateCcw, AlertCircle } from 'lucide-react';

interface VideoUploadPlayerProps {
  onVideoUploaded: (videoId: string) => void;
  onAnalysisUpdate: (analysis: any) => void;
  onAnalyzingChange: (isAnalyzing: boolean) => void;
}

export default function VideoUploadPlayer({ 
  onVideoUploaded, 
  onAnalysisUpdate,
  onAnalyzingChange 
}: VideoUploadPlayerProps) {
  const [videoId, setVideoId] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const analysisIntervalRef = useRef<NodeJS.Timeout | null>(null);
  
  const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000';

  console.log('🔧 VideoUploadPlayer render - videoId:', videoId, 'isAnalyzing:', isAnalyzing);

  // Handle file upload
  const handleFileSelect = async (file: File) => {
    if (!file) return;

    console.log('📤 Starting file upload:', file.name);
    setIsUploading(true);
    setUploadError(null);

    try {
      const formData = new FormData();
      formData.append('file', file);

      console.log('🌐 Sending upload request to:', `${API_BASE}/upload-video`);
      const response = await fetch(`${API_BASE}/upload-video`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Upload failed');
      }

      const result = await response.json();
      console.log('✅ Upload successful, videoId:', result.video_id);
      
      setVideoId(result.video_id);
      onVideoUploaded(result.video_id);
    } catch (error) {
      console.error('❌ Upload error:', error);
      setUploadError('Failed to upload video');
    } finally {
      setIsUploading(false);
    }
  };

  // Analyze current frame
  const analyzeFrame = useCallback(async () => {
    console.log('🎯 analyzeFrame called');
    
    const video = videoRef.current;
    const canvas = canvasRef.current;
    
    console.log('📹 Video ref:', !!video, 'Canvas ref:', !!canvas);
    
    if (!video || !canvas) {
      console.log('❌ Missing video or canvas ref');
      return;
    }
    
    console.log('📊 Video state - paused:', video.paused, 'ended:', video.ended, 'currentTime:', video.currentTime);
    
    try {
      const context = canvas.getContext('2d');
      if (!context) {
        console.log('❌ Could not get canvas context');
        return;
      }
      
      console.log('📏 Video dimensions:', video.videoWidth, 'x', video.videoHeight);
      
      // Set canvas size to match video
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      
      // Draw video frame to canvas
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      console.log('🎨 Drew video frame to canvas');
      
      // Convert to base64
      const frameData = canvas.toDataURL('image/jpeg', 0.8);
      console.log('🔧 Converted to base64, length:', frameData.length);
      
      const requestBody = {
        frame_data: frameData,
        timestamp: video.currentTime
      };
      
      console.log('🌐 Sending analysis request to:', `${API_BASE}/analyze-frame`);
      console.log('📊 Request body timestamp:', requestBody.timestamp, 'frame_data length:', requestBody.frame_data.length);
      
      // Send for analysis
      const response = await fetch(`${API_BASE}/analyze-frame`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      });
      
      console.log('📡 Analysis response status:', response.status, response.ok);
      
      if (response.ok) {
        const analysis = await response.json();
        console.log('✅ Analysis successful:', analysis);
        onAnalysisUpdate(analysis);
        drawBoundingBoxes(analysis);
      } else {
        const errorText = await response.text();
        console.error('❌ Analysis failed:', response.status, errorText);
      }
    } catch (error) {
      console.error('❌ Analysis error:', error);
    }
  }, [API_BASE, onAnalysisUpdate]);

  // Draw bounding boxes
  const drawBoundingBoxes = (analysis: any) => {
    console.log('🎨 Drawing bounding boxes for', analysis.detected_objects?.length, 'objects');

    const video = videoRef.current;
    const overlayCanvas = overlayCanvasRef.current;
    if (!video || !overlayCanvas) return;

    const ctx = overlayCanvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size to match video container
    overlayCanvas.width = video.offsetWidth;
    overlayCanvas.height = video.offsetHeight;

    // Clear previous drawings
    ctx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);

    // Compute actual rendered video area inside container (with black bars)
    const videoAspect = video.videoWidth / video.videoHeight;
    const containerAspect = video.offsetWidth / video.offsetHeight;

    let renderWidth = video.offsetWidth;
    let renderHeight = video.offsetHeight;
    let offsetX = 0;
    let offsetY = 0;

    if (videoAspect > containerAspect) {
      renderWidth = video.offsetWidth;
      renderHeight = renderWidth / videoAspect;
      offsetY = (video.offsetHeight - renderHeight) / 2;
    } else {
      renderHeight = video.offsetHeight;
      renderWidth = renderHeight * videoAspect;
      offsetX = (video.offsetWidth - renderWidth) / 2;
    }

    const scaleX = renderWidth / video.videoWidth;
    const scaleY = renderHeight / video.videoHeight;

    // Draw each bounding box
    analysis.detected_objects?.forEach((obj: any, index: number) => {
      const [x1, y1, x2, y2] = obj.bbox;

      const scaledX1 = offsetX + x1 * scaleX;
      const scaledY1 = offsetY + y1 * scaleY;
      const scaledX2 = offsetX + x2 * scaleX;
      const scaledY2 = offsetY + y2 * scaleY;

      const width = scaledX2 - scaledX1;
      const height = scaledY2 - scaledY1;

      // Draw box
      ctx.strokeStyle = '#00ff00';
      ctx.lineWidth = 2;
      ctx.strokeRect(scaledX1, scaledY1, width, height);

      // Draw label
      const label = `${obj.class} ${Math.round(obj.confidence * 100)}%`;
      ctx.font = '12px Arial';
      const textWidth = ctx.measureText(label).width;

      ctx.fillStyle = '#00ff00';
      ctx.fillRect(scaledX1, scaledY1 - 20, textWidth + 8, 20);

      ctx.fillStyle = '#000000';
      ctx.fillText(label, scaledX1 + 4, scaledY1 - 6);
    });
  };


  // Start analysis automatically when video is ready
  useEffect(() => {
    console.log('🔄 useEffect triggered - videoId:', videoId, 'isAnalyzing:', isAnalyzing);
    
    if (videoId && !isAnalyzing) {
      console.log('🚀 Starting analysis interval');
      setIsAnalyzing(true);
      onAnalyzingChange(true);
      
      // Start analysis at 2fps (every 500ms)
      analysisIntervalRef.current = setInterval(() => {
        console.log('⏰ Interval tick - calling analyzeFrame');
        analyzeFrame();
      }, 500);
    }
    
    // Cleanup function
    return () => {
      if (analysisIntervalRef.current) {
        console.log('🧹 Cleaning up analysis interval');
        clearInterval(analysisIntervalRef.current);
        analysisIntervalRef.current = null;
      }
    };
  }, [videoId]); // Only depend on videoId - NOT on analyzeFrame

  // Stop analysis when component unmounts
  useEffect(() => {
    return () => {
      if (analysisIntervalRef.current) {
        console.log('🧹 Component unmount - cleaning up interval');
        clearInterval(analysisIntervalRef.current);
      }
    };
  }, []);

  // Listen for time jump events
  useEffect(() => {
    const handleTimeJump = (event: any) => {
      console.log('⏭️ Time jump to:', event.detail);
      if (videoRef.current) {
        videoRef.current.currentTime = event.detail;
      }
    };

    window.addEventListener('video-time-jump', handleTimeJump);
    return () => window.removeEventListener('video-time-jump', handleTimeJump);
  }, []);

  // Drag and drop handlers
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('video/')) {
      handleFileSelect(file);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  // If no video uploaded, show upload interface
  if (!videoId) {
    return (
      <div className="h-full bg-gray-800 rounded-lg flex items-center justify-center">
        <div
          className="w-full max-w-md p-8 text-center"
          onDrop={handleDrop}
          onDragOver={handleDragOver}
        >
          <div className="mb-6">
            <div className="w-24 h-24 bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
              <Upload size={40} className="text-gray-400" />
            </div>
            <h3 className="text-xl font-semibold text-white mb-2">
              Upload a Video
            </h3>
            <p className="text-gray-400 mb-4">
              Drag & drop or click to select a video file
            </p>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="video/*"
            onChange={(e) => e.target.files?.[0] && handleFileSelect(e.target.files[0])}
            className="hidden"
          />
          
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 text-white px-6 py-3 rounded-lg font-medium transition-colors"
          >
            {isUploading ? 'Uploading...' : 'Select Video'}
          </button>

          {uploadError && (
            <div className="mt-4 text-red-400 flex items-center justify-center">
              <AlertCircle size={16} className="mr-2" />
              {uploadError}
            </div>
          )}
        </div>
      </div>
    );
  }

  // Video player interface
  return (
    <div className="h-full bg-gray-800 rounded-lg overflow-hidden flex flex-col">
      {/* Video Container */}
      <div className="flex-1 relative bg-black">
        <video
          ref={videoRef}
          src={`${API_BASE}/video/${videoId}`}
          crossOrigin="anonymous"
          className="absolute top-0 left-0 w-full h-full object-contain max-h-full max-w-full"
          onPlay={() => {
            console.log('▶️ Video started playing');
            setIsPlaying(true);
          }}
          onPause={() => {
            console.log('⏸️ Video paused');
            setIsPlaying(false);
          }}
          onEnded={() => {
            console.log('⏹️ Video ended');
            setIsPlaying(false);
          }}
          onLoadedData={() => {
            console.log('📹 Video loaded data');
          }}
          onCanPlay={() => {
            console.log('✅ Video can play');
          }}
        />
        
        {/* Hidden canvas for frame capture */}
        <canvas ref={canvasRef} className="hidden" />
        
        {/* Overlay canvas for bounding boxes */}
        <canvas
          ref={overlayCanvasRef}
          className="absolute top-0 left-0 pointer-events-none"
          style={{ width: '100%', height: '100%' }}
        />

        {/* Play button overlay */}
        {!isPlaying && (
          <div
            className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-40 cursor-pointer"
            onClick={() => {
              console.log('🎬 Play button clicked');
              videoRef.current?.play();
            }}
          >
            <div className="bg-blue-600 hover:bg-blue-700 rounded-full p-6 transition-all transform hover:scale-110">
              <Play size={48} className="text-white ml-2" />
            </div>
          </div>
        )}
      </div>

      {/* Simple Controls */}
      <div className="bg-gray-700 p-4 flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <button
            onClick={() => {
              console.log('🎮 Control button clicked');
              videoRef.current?.paused ? videoRef.current?.play() : videoRef.current?.pause();
            }}
            className="bg-blue-600 hover:bg-blue-700 text-white p-3 rounded-lg transition-colors"
          >
            {isPlaying ? <Pause size={24} /> : <Play size={24} />}
          </button>
          
          <button
            onClick={() => {
              console.log('⏮️ Restart button clicked');
              if (videoRef.current) {
                videoRef.current.currentTime = 0;
              }
            }}
            className="bg-gray-600 hover:bg-gray-500 text-white p-3 rounded-lg transition-colors"
          >
            <RotateCcw size={24} />
          </button>
        </div>

        <div className="text-gray-300 text-sm">
          {isAnalyzing ? '🔴 Analyzing at 2fps' : '⚪ Analysis paused'}
        </div>
      </div>
    </div>
  );
}