from fastapi import FastAPI, HTTPException, UploadFile, File, BackgroundTasks
from fastapi.responses import HTMLResponse, FileResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
import os
import json
import uuid
import shutil
from pathlib import Path
from typing import List, Dict, Optional
import asyncio
from datetime import datetime

from analyzer import VisionAnalyzer

app = FastAPI(
    title="First-Person Video Analysis",
    description="First-person skateboarding video analysis with computer vision",
    version="0.1.0"
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Create directories for outputs
os.makedirs("output_frames", exist_ok=True)
os.makedirs("segmented_frames", exist_ok=True)
os.makedirs("uploaded_videos", exist_ok=True)

# Mount static files for serving segmented frames
app.mount("/static", StaticFiles(directory="segmented_frames"), name="static")

# Initialize analyzer
analyzer = VisionAnalyzer()

# Global dictionary to track processing status
processing_status = {}

class ProcessingStatus:
    def __init__(self, video_id: str, filename: str):
        self.video_id = video_id
        self.filename = filename
        self.status = "uploaded"  # uploaded, extracting, analyzing, complete, error
        self.progress = 0  # 0-100
        self.current_step = "File uploaded successfully"
        self.total_frames = 0
        self.processed_frames = 0
        self.start_time = datetime.now()
        self.error_message = None
        
    def to_dict(self):
        return {
            "video_id": self.video_id,
            "filename": self.filename,
            "status": self.status,
            "progress": self.progress,
            "current_step": self.current_step,
            "total_frames": self.total_frames,
            "processed_frames": self.processed_frames,
            "elapsed_time": str(datetime.now() - self.start_time),
            "error_message": self.error_message
        }

import asyncio
import threading
from concurrent.futures import ThreadPoolExecutor

# Add at the top, after imports
executor = ThreadPoolExecutor(max_workers=1)

def process_video_sync(video_id: str, video_path: str):
    """Synchronous video processing (runs in thread)"""
    status = processing_status[video_id]
    
    try:
        status.status = "extracting"
        status.current_step = "Extracting frames from video..."
        status.progress = 10
        
        # Extract frames
        frames, timestamps = analyzer.extract_frames(video_path, interval_seconds=0.5)
        status.total_frames = len(frames)
        status.progress = 20
        status.current_step = f"Extracted {len(frames)} frames. Starting AI analysis..."
        
        if not frames:
            status.status = "error"
            status.error_message = "No frames could be extracted from video"
            return
            
        status.status = "analyzing"
        results = []
        
        for i, (frame, timestamp) in enumerate(zip(frames, timestamps)):
            # Update progress
            status.processed_frames = i + 1
            status.progress = 20 + (70 * (i + 1) / len(frames))  # 20-90%
            status.current_step = f"Analyzing frame {i + 1}/{len(frames)} with AI..."
            
            # Analyze frame
            analysis = analyzer.analyze_frame(frame)
            
            # Create segmented frame
            segmented_frame = analyzer.create_segmented_frame(frame, analysis)
            
            # Save segmented frame
            video_name = Path(video_path).stem
            frame_filename = f"segmented_frames/{video_name}_frame_{i:03d}.jpg"
            analyzer.save_frame(segmented_frame, frame_filename)
            
            # Generate text analysis
            text_analysis = analyzer.generate_text_analysis(analysis, timestamp)
            
            results.append({
                'frame_id': i,
                'timestamp': timestamp,
                'time_formatted': f"{int(timestamp//60):02d}:{int(timestamp%60):02d}",
                'text_analysis': text_analysis,
                'detected_objects': analysis['detected_objects'],
                'segmented_frame_path': frame_filename,
                'navigation_summary': analyzer.get_navigation_summary(analysis)
            })
        
        # Save results
        video_name = Path(video_path).stem
        results_path = f"output_frames/{video_name}_analysis.json"
        with open(results_path, 'w') as f:
            json.dump(results, f, indent=2)
        
        # Complete
        status.status = "complete"
        status.progress = 100
        status.current_step = f"Analysis complete! Processed {len(frames)} frames."
        
    except Exception as e:
        status.status = "error"
        status.error_message = str(e)
        status.current_step = f"Error during processing: {str(e)}"
        print(f"Error processing video {video_id}: {e}")

async def process_video_background(video_id: str, video_path: str):
    """Background task wrapper that runs sync processing in thread"""
    loop = asyncio.get_event_loop()
    await loop.run_in_executor(executor, process_video_sync, video_id, video_path)

@app.get("/")
async def root():
    return HTMLResponse("""
    <html>
        <head>
            <title>First-Person Video Analysis</title>
            <style>
                body { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }
            </style>
        </head>
        <body>
            <h1>🎥 First-Person Video Analysis API</h1>
            <p>Upload and analyze first-person videos with computer vision</p>
            
            <h2>📋 Endpoints:</h2>
            <ul>
                <li><strong>POST /upload-video</strong> - Upload video for analysis</li>
                <li><strong>GET /processing-status/{video_id}</strong> - Check processing progress</li>
                <li><strong>GET /results/{video_name}</strong> - Get analysis results</li>
                <li><strong>GET /segmented-frame/{video_name}/{frame_id}</strong> - View segmented frames</li>
            </ul>
            
            <p>Visit <a href="http://localhost:3000">http://localhost:3000</a> for the web interface.</p>
        </body>
    </html>
    """)

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy", "analyzer": "ready", "models": "loaded"}

@app.post("/upload-video")
async def upload_video(background_tasks: BackgroundTasks, file: UploadFile = File(...)):
    """Upload video file and start processing"""
    
    # Validate file type
    if not file.filename.lower().endswith(('.mp4', '.mov', '.avi')):
        raise HTTPException(status_code=400, detail="Only MP4, MOV, and AVI files are supported")
    
    # Generate unique video ID
    video_id = str(uuid.uuid4())
    
    # Create safe filename
    safe_filename = f"{video_id}_{file.filename}"
    video_path = f"uploaded_videos/{safe_filename}"
    
    try:
        # Save uploaded file
        with open(video_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        
        # Initialize processing status
        status = ProcessingStatus(video_id, file.filename)
        processing_status[video_id] = status
        
        # Start background processing
        background_tasks.add_task(process_video_background, video_id, video_path)
        
        return {
            "video_id": video_id,
            "filename": file.filename,
            "status": "uploaded",
            "message": "Video uploaded successfully. Processing started.",
            "video_name": Path(video_path).stem,  # This will be used for results
            "original_filename": file.filename  # Keep track of original name
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error uploading file: {str(e)}")

@app.get("/processing-status/{video_id}")
async def get_processing_status(video_id: str):
    """Get current processing status for a video"""
    if video_id not in processing_status:
        raise HTTPException(status_code=404, detail="Video ID not found")
    
    return processing_status[video_id].to_dict()

@app.get("/results/{video_name}")
async def get_results(video_name: str):
    """Get complete analysis results for a video"""
    results_path = f"output_frames/{video_name}_analysis.json"
    
    if not os.path.exists(results_path):
        raise HTTPException(
            status_code=404, 
            detail=f"Analysis results for '{video_name}' not found. Process the video first."
        )
    
    with open(results_path, 'r') as f:
        results = json.load(f)
    
    return {
        'video_name': video_name,
        'total_frames': len(results),
        'analysis_type': 'first_person_navigation',
        'results': results
    }

@app.get("/video/{video_name}")
async def serve_video(video_name: str):
    """Serve the original uploaded video file"""
    # Look for video file in uploaded_videos directory
    video_extensions = ['.mp4', '.mov', '.avi']
    video_path = None
    
    for ext in video_extensions:
        potential_path = f"uploaded_videos/{video_name}{ext}"
        if os.path.exists(potential_path):
            video_path = potential_path
            break
        
        # Also check for files that start with UUID_filename pattern
        for file in os.listdir("uploaded_videos"):
            if file.endswith(f"_{video_name}{ext}"):
                video_path = f"uploaded_videos/{file}"
                break
    
    if not video_path or not os.path.exists(video_path):
        raise HTTPException(status_code=404, detail=f"Video file for '{video_name}' not found")
    
    return FileResponse(
        video_path,
        media_type="video/mp4",
        headers={
            "Accept-Ranges": "bytes",
            "Cache-Control": "no-cache",
        }
    )

@app.get("/segmented-frame/{video_name}/{frame_id}")
async def get_segmented_frame(video_name: str, frame_id: int):
    """Get a specific segmented frame with overlays"""
    frame_path = f"segmented_frames/{video_name}_frame_{frame_id:03d}.jpg"
    
    if not os.path.exists(frame_path):
        raise HTTPException(
            status_code=404, 
            detail=f"Segmented frame {frame_id} for '{video_name}' not found."
        )
    
    return FileResponse(
        frame_path, 
        media_type="image/jpeg",
        headers={"Cache-Control": "max-age=3600"}
    )

@app.get("/analysis-text/{video_name}")
async def get_analysis_text(video_name: str):
    """Get formatted text analysis"""
    results_path = f"output_frames/{video_name}_analysis.json"
    
    if not os.path.exists(results_path):
        raise HTTPException(
            status_code=404, 
            detail=f"Analysis results for '{video_name}' not found."
        )
    
    with open(results_path, 'r') as f:
        results = json.load(f)
    
    # Format as continuous navigation log
    text_lines = []
    for result in results:
        text_lines.append(result['text_analysis'])
    
    full_text = "\n".join(text_lines)
    
    # Generate summary stats
    risk_levels = [r.get('navigation_summary', {}).get('risk_level', 'UNKNOWN') for r in results]
    high_risk_count = risk_levels.count('HIGH')
    medium_risk_count = risk_levels.count('MEDIUM')
    
    return {
        'video_name': video_name,
        'analysis_type': 'first_person_navigation',
        'text_analysis': full_text,
        'total_segments': len(results),
        'session_stats': {
            'high_risk_moments': high_risk_count,
            'medium_risk_moments': medium_risk_count,
            'low_risk_moments': len(risk_levels) - high_risk_count - medium_risk_count,
            'total_duration': f"{results[-1]['timestamp']:.1f}s" if results else "0s"
        }
    }

@app.delete("/video/{video_id}")
async def delete_video(video_id: str):
    """Delete uploaded video and associated files"""
    if video_id in processing_status:
        del processing_status[video_id]
    
    # Clean up files (optional - implement if needed)
    return {"message": "Video deleted successfully"}

if __name__ == "__main__":
    import uvicorn
    print("🎥 Starting First-Person Video Analysis Server...")
    print("📁 Upload videos via web interface at http://localhost:3000")
    print("📊 API documentation at: http://localhost:8000/docs")
    uvicorn.run(app, host="0.0.0.0", port=8000)