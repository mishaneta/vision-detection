from fastapi import FastAPI, HTTPException, UploadFile, File, BackgroundTasks
from fastapi.responses import HTMLResponse, FileResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
import os
import json
import uuid
import shutil
import cv2
import numpy as np
import base64
from pathlib import Path
from typing import Dict
import tempfile
from datetime import datetime

from analyzer import VisionAnalyzer

app = FastAPI(
    title="Real-time Video Analysis",
    description="Real-time object detection with live commentary",
    version="2.0.0"
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Create temporary directory for session videos
TEMP_VIDEO_DIR = tempfile.mkdtemp(prefix="realtime_videos_")
print(f"📁 Temporary video directory: {TEMP_VIDEO_DIR}")

# Initialize analyzer
analyzer = VisionAnalyzer()

# Store video paths for current session
session_videos = {}

@app.on_event("shutdown")
async def cleanup():
    """Clean up temporary files on shutdown"""
    import shutil
    try:
        shutil.rmtree(TEMP_VIDEO_DIR)
        print("🧹 Cleaned up temporary videos")
    except:
        pass

@app.get("/")
async def root():
    return HTMLResponse("""
    <html>
        <head>
            <title>Real-time Video Analysis</title>
            <style>
                body { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }
                .feature { background: #f5f5f5; padding: 15px; margin: 10px 0; border-radius: 8px; }
            </style>
        </head>
        <body>
            <h1>🎥 Real-time Video Analysis API</h1>
            <p>Upload and analyze videos with real-time object detection and live commentary</p>
            
            <h2>📋 Endpoints:</h2>
            <ul>
                <li><strong>POST /upload-video</strong> - Upload video for real-time analysis</li>
                <li><strong>POST /analyze-frame</strong> - Analyze current video frame</li>
                <li><strong>GET /video/{video_id}</strong> - Stream uploaded video</li>
            </ul>
            
            <div class="feature">
                <h3>⚡ Real-time Analysis</h3>
                <p>Live object detection at 2fps with descriptive scene commentary</p>
            </div>
            
            <p>Visit <a href="http://localhost:3000">http://localhost:3000</a> for the web interface.</p>
        </body>
    </html>
    """)

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    print("🏥 Health check requested")
    return {
        "status": "healthy",
        "analyzer": "ready",
        "mode": "realtime"
    }

@app.post("/upload-video")
async def upload_video(file: UploadFile = File(...)):
    """Upload video file for real-time analysis"""
    
    print(f"\n📤 === VIDEO UPLOAD START ===")
    print(f"📁 File: {file.filename}")
    print(f"📏 Content type: {file.content_type}")
    
    # Validate file type
    if not file.filename.lower().endswith(('.mp4', '.mov', '.avi', '.webm')):
        print(f"❌ Invalid file format: {file.filename}")
        raise HTTPException(status_code=400, detail="Unsupported video format")
    
    # Generate unique video ID
    video_id = str(uuid.uuid4())
    print(f"🆔 Generated video ID: {video_id}")
    
    # Save to temporary directory
    video_path = os.path.join(TEMP_VIDEO_DIR, f"{video_id}_{file.filename}")
    
    try:
        # Save uploaded file
        with open(video_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        
        # Get file size
        file_size = os.path.getsize(video_path)
        print(f"💾 Saved to: {video_path}")
        print(f"📊 File size: {file_size / (1024*1024):.2f} MB")
        
        # Store in session
        session_videos[video_id] = {
            'path': video_path,
            'filename': file.filename,
            'uploaded_at': datetime.now().isoformat(),
            'size_bytes': file_size
        }
        
        print(f"✅ Upload successful")
        print(f"📤 === VIDEO UPLOAD END ===\n")
        
        return {
            "video_id": video_id,
            "filename": file.filename,
            "message": "Video uploaded successfully"
        }
        
    except Exception as e:
        print(f"❌ Upload failed: {str(e)}")
        print(f"📤 === VIDEO UPLOAD END ===\n")
        raise HTTPException(status_code=500, detail=f"Upload failed: {str(e)}")

@app.get("/video/{video_id}")
async def serve_video(video_id: str):
    """Stream video file"""
    print(f"\n🎬 Video request for ID: {video_id}")
    
    if video_id not in session_videos:
        print(f"❌ Video ID not found in session")
        raise HTTPException(status_code=404, detail="Video not found")
    
    video_path = session_videos[video_id]['path']
    print(f"📁 Serving video from: {video_path}")
    
    if not os.path.exists(video_path):
        print(f"❌ Video file not found on disk")
        raise HTTPException(status_code=404, detail="Video file not found")
    
    print(f"✅ Video served successfully")
    return FileResponse(
        video_path,
        media_type="video/mp4",
        headers={
            "Accept-Ranges": "bytes",
            "Cache-Control": "no-cache"
        }
    )

@app.post("/analyze-frame")
async def analyze_frame(request: dict):
    """Analyze a single frame in real-time"""
    print(f"\n🎯 === FRAME ANALYSIS REQUEST ===")
    
    try:
        frame_data = request.get('frame_data')
        timestamp = request.get('timestamp', 0.0)
        
        print(f"⏰ Timestamp: {timestamp:.2f}s")
        
        if not frame_data:
            print(f"❌ No frame data provided")
            raise HTTPException(status_code=400, detail="frame_data is required")
        
        # Decode base64 image
        print(f"🔓 Decoding base64 frame data...")
        if ',' in frame_data:
            image_data = base64.b64decode(frame_data.split(',')[1])
        else:
            image_data = base64.b64decode(frame_data)
        
        print(f"📊 Decoded image size: {len(image_data)} bytes")
        
        # Convert to OpenCV format
        print(f"🖼️  Converting to OpenCV format...")
        nparr = np.frombuffer(image_data, np.uint8)
        frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        
        if frame is None:
            print(f"❌ Could not decode frame")
            raise ValueError("Could not decode frame")
        
        print(f"✅ Frame decoded successfully: {frame.shape}")
        
        # Analyze frame with YOLO
        print(f"🤖 Starting YOLO analysis...")
        analysis = analyzer.analyze_frame(frame)
        
        # Generate descriptive text
        print(f"📝 Generating scene description...")
        scene_description = analyzer.generate_scene_description(analysis, timestamp)
        
        # Format response
        response = {
            'timestamp': timestamp,
            'detected_objects': analysis['detected_objects'],
            'scene_description': scene_description,
            'total_objects': analysis['total_detections']
        }
        
        print(f"\n📋 === ANALYSIS SUMMARY ===")
        print(f"⏰ Timestamp: {timestamp:.2f}s")
        print(f"🎯 Objects detected: {analysis['total_detections']}")
        if analysis['detected_objects']:
            object_types = {}
            for obj in analysis['detected_objects']:
                obj_class = obj['class']
                object_types[obj_class] = object_types.get(obj_class, 0) + 1
            print(f"📊 Object types: {dict(object_types)}")
        print(f"📄 Description: '{scene_description}'")
        print(f"📋 === ANALYSIS SUMMARY END ===")
        print(f"🎯 === FRAME ANALYSIS REQUEST END ===\n")
        
        return response
        
    except Exception as e:
        print(f"❌ Frame analysis error: {e}")
        print(f"🎯 === FRAME ANALYSIS REQUEST END ===\n")
        return {
            'timestamp': timestamp,
            'error': str(e),
            'detected_objects': [],
            'scene_description': "Analysis error occurred",
            'total_objects': 0
        }

@app.get("/session-videos")
async def list_session_videos():
    """List videos in current session"""
    print(f"\n📋 Session videos requested")
    print(f"📊 Current session has {len(session_videos)} videos:")
    
    for vid, info in session_videos.items():
        print(f"  🎬 {vid}: {info['filename']} ({info.get('size_bytes', 0) / (1024*1024):.2f} MB)")
    
    return {
        "videos": [
            {
                "video_id": vid,
                "filename": info['filename'],
                "uploaded_at": info['uploaded_at']
            }
            for vid, info in session_videos.items()
        ]
    }

if __name__ == "__main__":
    import uvicorn
    print("🎥 Starting Real-time Video Analysis Server...")
    print("📁 Videos stored temporarily in session")
    print("🌐 Web interface at: http://localhost:3000")
    print("📊 API documentation at: http://localhost:8000/docs")
    print("🐛 Debug mode: ON - All detection info will be printed to terminal")
    uvicorn.run(app, host="0.0.0.0", port=8000)