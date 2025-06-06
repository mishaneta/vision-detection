'use client';

import { useState, useCallback } from 'react';
import { Upload, X, Play, AlertCircle, CheckCircle } from 'lucide-react';

interface ProcessingStatus {
  video_id: string;
  filename: string;
  status: 'uploaded' | 'extracting' | 'analyzing' | 'complete' | 'error';
  progress: number;
  current_step: string;
  total_frames: number;
  processed_frames: number;
  elapsed_time: string;
  error_message?: string;
}

interface VideoUploadProps {
  apiBase: string;
  onAnalysisComplete: (videoName: string) => void;
}

export default function VideoUpload({ apiBase, onAnalysisComplete }: VideoUploadProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [processingStatus, setProcessingStatus] = useState<ProcessingStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Handle drag events
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    
    const files = Array.from(e.dataTransfer.files);
    const videoFile = files.find(file => 
      file.type.startsWith('video/') || 
      file.name.toLowerCase().endsWith('.mov') ||
      file.name.toLowerCase().endsWith('.mp4') ||
      file.name.toLowerCase().endsWith('.avi')
    );
    
    if (videoFile) {
      setSelectedFile(videoFile);
      setError(null);
    } else {
      setError('Please select a valid video file (MP4, MOV, or AVI)');
    }
  }, []);

  // Handle file input change
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setError(null);
    }
  };

  // Upload and process video
  const handleUpload = async () => {
    if (!selectedFile) return;

    setIsUploading(true);
    setError(null);

    try {
      // Upload file
      const formData = new FormData();
      formData.append('file', selectedFile);

      const uploadResponse = await fetch(`${apiBase}/upload-video`, {
        method: 'POST',
        body: formData,
      });

      if (!uploadResponse.ok) {
        const errorData = await uploadResponse.json();
        throw new Error(errorData.detail || 'Upload failed');
      }

      const uploadResult = await uploadResponse.json();
      console.log('Upload result:', uploadResult);

      // Start polling for processing status
      pollProcessingStatus(uploadResult.video_id, uploadResult.video_name);

    } catch (err) {
      console.error('Upload error:', err);
      setError(err instanceof Error ? err.message : 'Upload failed');
      setIsUploading(false);
    }
  };

  // Poll processing status
  const pollProcessingStatus = async (videoId: string, videoName: string) => {
    const pollInterval = setInterval(async () => {
      try {
        const response = await fetch(`${apiBase}/processing-status/${videoId}`);
        if (response.ok) {
          const status: ProcessingStatus = await response.json();
          setProcessingStatus(status);

          if (status.status === 'complete') {
            clearInterval(pollInterval);
            setIsUploading(false);
            // Notify parent component that analysis is complete
            setTimeout(() => {
              onAnalysisComplete(videoName);
            }, 1000); // Small delay to show completion
          } else if (status.status === 'error') {
            clearInterval(pollInterval);
            setIsUploading(false);
            setError(status.error_message || 'Processing failed');
          }
        }
      } catch (err) {
        console.error('Status polling error:', err);
      }
    }, 1000); // Poll every second

    // Clean up interval after 10 minutes
    setTimeout(() => clearInterval(pollInterval), 600000);
  };

  // Reset upload state
  const handleReset = () => {
    setSelectedFile(null);
    setProcessingStatus(null);
    setError(null);
    setIsUploading(false);
  };

  // Render processing progress
  if (isUploading && processingStatus) {
    return (
      <div className="max-w-2xl mx-auto p-8">
        <div className="bg-gray-800 rounded-2xl p-8 border border-gray-700">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">
              {processingStatus.status === 'complete' ? (
                <CheckCircle size={32} className="text-white" />
              ) : processingStatus.status === 'error' ? (
                <AlertCircle size={32} className="text-white" />
              ) : (
                <Play size={32} className="text-white" />
              )}
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">
              {processingStatus.status === 'complete' ? 'Analysis Complete!' :
               processingStatus.status === 'error' ? 'Processing Error' :
               'Processing Video...'}
            </h2>
            <p className="text-gray-400">{processingStatus.filename}</p>
          </div>

          {/* Progress Bar */}
          <div className="mb-6">
            <div className="flex justify-between text-sm text-gray-400 mb-2">
              <span>{processingStatus.current_step}</span>
              <span>{Math.round(processingStatus.progress)}%</span>
            </div>
            <div className="w-full bg-gray-700 rounded-full h-3">
              <div 
                className={`h-3 rounded-full transition-all duration-500 ${
                  processingStatus.status === 'complete' ? 'bg-green-500' :
                  processingStatus.status === 'error' ? 'bg-red-500' :
                  'bg-blue-500'
                }`}
                style={{ width: `${processingStatus.progress}%` }}
              />
            </div>
          </div>

          {/* Status Details */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="bg-gray-700 rounded-lg p-4 text-center">
              <div className="text-2xl font-bold text-white">{processingStatus.total_frames}</div>
              <div className="text-sm text-gray-400">Total Frames</div>
            </div>
            <div className="bg-gray-700 rounded-lg p-4 text-center">
              <div className="text-2xl font-bold text-white">{processingStatus.processed_frames}</div>
              <div className="text-sm text-gray-400">Processed</div>
            </div>
            <div className="bg-gray-700 rounded-lg p-4 text-center">
              <div className="text-2xl font-bold text-white">{processingStatus.elapsed_time.split('.')[0]}</div>
              <div className="text-sm text-gray-400">Elapsed</div>
            </div>
          </div>

          {/* Error Message */}
          {processingStatus.status === 'error' && (
            <div className="bg-red-900/20 border border-red-500 rounded-lg p-4 mb-4">
              <p className="text-red-400">{processingStatus.error_message}</p>
            </div>
          )}

          {/* Completion Message */}
          {processingStatus.status === 'complete' && (
            <div className="bg-green-900/20 border border-green-500 rounded-lg p-4 mb-4">
              <p className="text-green-400">Video analysis complete! Redirecting to results...</p>
            </div>
          )}

          {/* Reset Button for Error */}
          {processingStatus.status === 'error' && (
            <button
              onClick={handleReset}
              className="w-full bg-gray-600 hover:bg-gray-500 text-white py-3 px-6 rounded-lg transition-colors"
            >
              Try Again
            </button>
          )}
        </div>
      </div>
    );
  }

  // Main upload interface
  return (
    <div className="max-w-2xl mx-auto p-8">
      <div className="text-center mb-8">
        <h1 className="text-4xl font-bold text-white mb-4">🎥 First-Person Video Analysis</h1>
        <p className="text-gray-400 text-lg">
          Upload your skateboarding or first-person video to get AI-powered navigation analysis
        </p>
      </div>

      {/* Upload Area */}
      <div
        className={`relative border-2 border-dashed rounded-2xl p-12 text-center transition-all ${
          isDragOver 
            ? 'border-blue-400 bg-blue-900/20' 
            : selectedFile 
              ? 'border-green-400 bg-green-900/20'
              : 'border-gray-600 bg-gray-800/50 hover:border-gray-500'
        }`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {/* Upload Icon */}
        <div className="mb-6">
          {selectedFile ? (
            <div className="w-20 h-20 bg-green-600 rounded-full flex items-center justify-center mx-auto">
              <CheckCircle size={40} className="text-white" />
            </div>
          ) : (
            <div className="w-20 h-20 bg-gray-700 rounded-full flex items-center justify-center mx-auto">
              <Upload size={40} className="text-gray-400" />
            </div>
          )}
        </div>

        {/* Upload Text */}
        {selectedFile ? (
          <div>
            <h3 className="text-xl font-semibold text-white mb-2">File Selected</h3>
            <p className="text-green-400 mb-2">{selectedFile.name}</p>
            <p className="text-gray-400 text-sm">
              Size: {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB
            </p>
          </div>
        ) : (
          <div>
            <h3 className="text-xl font-semibold text-white mb-2">
              {isDragOver ? 'Drop your video here' : 'Drag & drop your video'}
            </h3>
            <p className="text-gray-400 mb-4">or click to browse files</p>
            <p className="text-sm text-gray-500">Supports MP4, MOV, AVI files</p>
          </div>
        )}

        {/* Hidden File Input */}
        <input
          type="file"
          accept="video/*,.mov,.mp4,.avi"
          onChange={handleFileSelect}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
        />

        {/* Remove File Button */}
        {selectedFile && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              setSelectedFile(null);
            }}
            className="absolute top-4 right-4 p-2 bg-gray-700 hover:bg-gray-600 rounded-full transition-colors"
          >
            <X size={20} className="text-white" />
          </button>
        )}
      </div>

      {/* Error Message */}
      {error && (
        <div className="mt-4 bg-red-900/20 border border-red-500 rounded-lg p-4">
          <p className="text-red-400">{error}</p>
        </div>
      )}

      {/* Upload Button */}
      {selectedFile && (
        <div className="mt-6">
          <button
            onClick={handleUpload}
            disabled={isUploading}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 text-white py-4 px-6 rounded-xl font-semibold text-lg transition-colors"
          >
            {isUploading ? 'Processing...' : 'Analyze Video'}
          </button>
        </div>
      )}

      {/* Info Cards */}
      <div className="mt-12 grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-gray-800 rounded-lg p-6">
          <h4 className="text-lg font-semibold text-white mb-3">What We Analyze</h4>
          <ul className="text-gray-400 space-y-2 text-sm">
            <li>• Pedestrians and vehicles in path</li>
            <li>• Risk assessment (HIGH/MEDIUM/LOW)</li>
            <li>• Navigation recommendations</li>
            <li>• Object detection and tracking</li>
          </ul>
        </div>
        
        <div className="bg-gray-800 rounded-lg p-6">
          <h4 className="text-lg font-semibold text-white mb-3">Processing Time</h4>
          <ul className="text-gray-400 space-y-2 text-sm">
            <li>• ~30 seconds: Short clips (≤30s)</li>
            <li>• ~2-3 minutes: Medium videos (1-2 min)</li>
            <li>• Frame extraction + AI analysis</li>
            <li>• Real-time progress tracking</li>
          </ul>
        </div>
      </div>
    </div>
  );
}