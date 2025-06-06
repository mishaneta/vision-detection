import cv2
import numpy as np
from ultralytics import YOLO
import torch
from typing import List, Dict, Tuple
from pathlib import Path

class VisionAnalyzer:
    """First-person skateboarding video analysis using YOLOv8"""
    
    def __init__(self):
        """Initialize the analyzer with YOLOv8 model"""
        # Initialize YOLOv8 model (will download on first use)
        self.model = YOLO('yolov8n-seg.pt')  # nano version with segmentation
        
        # Define classes relevant to first-person navigation
        self.navigation_classes = [
            'person', 'bicycle', 'car', 'motorcycle', 'bus', 'truck',
            'traffic light', 'fire hydrant', 'stop sign', 'parking meter', 
            'bench', 'backpack', 'umbrella', 'handbag', 'suitcase',
            'sports ball', 'bottle', 'chair', 'potted plant', 'skateboard'
        ]
        
        # High priority objects for navigation safety
        self.safety_critical_classes = [
            'person', 'car', 'motorcycle', 'bus', 'truck', 'bicycle',
            'traffic light', 'stop sign'
        ]
        
        # COCO class names (YOLOv8 uses COCO dataset)
        self.class_names = self.model.names
        
        print(f"🔧 Initialized VisionAnalyzer with YOLOv8")
        print(f"📱 Device: {'CUDA' if torch.cuda.is_available() else 'CPU'}")
        
    def extract_frames(self, video_path: str, interval_seconds: int = 1) -> Tuple[List[np.ndarray], List[float]]:
        """Extract frames from video at specified intervals
        
        Args:
            video_path: Path to the video file
            interval_seconds: Extract frame every N seconds
            
        Returns:
            Tuple of (frames, timestamps)
        """
        cap = cv2.VideoCapture(video_path)
        
        if not cap.isOpened():
            raise ValueError(f"Could not open video file: {video_path}")
            
        fps = cap.get(cv2.CAP_PROP_FPS)
        total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        duration = total_frames / fps
        
        print(f"📹 Video info: {duration:.1f}s duration, {fps:.1f} FPS, {total_frames} total frames")
        
        frame_interval = int(fps * interval_seconds)
        frames = []
        timestamps = []
        frame_count = 0
        
        while True:
            ret, frame = cap.read()
            if not ret:
                break
                
            # Extract frame at specified intervals
            if frame_count % frame_interval == 0:
                frames.append(frame.copy())
                timestamp = frame_count / fps
                timestamps.append(timestamp)
                print(f"⏱️  Extracted frame at {timestamp:.1f}s")
                
            frame_count += 1
            
        cap.release()
        print(f"✅ Extracted {len(frames)} frames at {interval_seconds}s intervals")
        return frames, timestamps
    
    def analyze_frame(self, frame: np.ndarray) -> Dict:
        """Analyze single frame for navigation elements using YOLOv8
        
        Args:
            frame: Input frame as numpy array
            
        Returns:
            Dictionary containing detection results
        """
        # Run YOLOv8 inference
        results = self.model(frame, verbose=False)
        result = results[0]  # Get first (and only) result
        
        # Parse detected objects
        detected_objects = []
        
        if result.boxes is not None and len(result.boxes) > 0:
            boxes = result.boxes.xyxy.cpu().numpy()  # x1, y1, x2, y2
            scores = result.boxes.conf.cpu().numpy()  # confidence scores
            classes = result.boxes.cls.cpu().numpy().astype(int)  # class indices
            
            for i, (box, score, cls_id) in enumerate(zip(boxes, scores, classes)):
                class_name = self.class_names[cls_id]
                
                detected_objects.append({
                    'id': i,
                    'class': class_name,
                    'confidence': float(score),
                    'bbox': box.tolist(),  # [x1, y1, x2, y2]
                    'navigation_relevant': class_name in self.navigation_classes,
                    'safety_critical': class_name in self.safety_critical_classes,
                    'center': [(box[0] + box[2]) / 2, (box[1] + box[3]) / 2]  # Center point
                })
        
        return {
            'detected_objects': detected_objects,
            'yolo_result': result,  # Store for visualization
            'total_detections': len(detected_objects),
            'safety_objects_count': sum(1 for obj in detected_objects if obj['safety_critical'])
        }
    
    def create_segmented_frame(self, frame: np.ndarray, analysis: Dict) -> np.ndarray:
        """Create frame with YOLOv8 segmentation overlays
        
        Args:
            frame: Original frame
            analysis: Analysis results from analyze_frame
            
        Returns:
            Frame with segmentation overlays
        """
        result = analysis['yolo_result']
        
        # Create a copy of the frame for drawing
        annotated_frame = frame.copy()
        
        # Draw bounding boxes and labels
        if result.boxes is not None and len(result.boxes) > 0:
            boxes = result.boxes.xyxy.cpu().numpy()
            scores = result.boxes.conf.cpu().numpy()
            classes = result.boxes.cls.cpu().numpy().astype(int)
            
            for box, score, cls_id in zip(boxes, scores, classes):
                x1, y1, x2, y2 = box.astype(int)
                class_name = self.class_names[cls_id]
                
                # Choose color based on object type
                if class_name in self.safety_critical_classes:
                    color = (0, 0, 255)  # Red for critical objects
                elif class_name in self.navigation_classes:
                    color = (0, 255, 255)  # Yellow for navigation relevant
                else:
                    color = (0, 255, 0)  # Green for others
                
                # Draw bounding box
                cv2.rectangle(annotated_frame, (x1, y1), (x2, y2), color, 2)
                
                # Draw label with confidence
                label = f"{class_name}: {score:.2f}"
                label_size = cv2.getTextSize(label, cv2.FONT_HERSHEY_SIMPLEX, 0.5, 2)[0]
                
                # Draw label background
                cv2.rectangle(annotated_frame, (x1, y1 - label_size[1] - 10), 
                            (x1 + label_size[0], y1), color, -1)
                
                # Draw label text
                cv2.putText(annotated_frame, label, (x1, y1 - 5), 
                          cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 255, 255), 2)
        
        # Draw segmentation masks if available
        if hasattr(result, 'masks') and result.masks is not None:
            masks = result.masks.data.cpu().numpy()
            
            for i, mask in enumerate(masks):
                # Resize mask to frame size
                mask_resized = cv2.resize(mask, (frame.shape[1], frame.shape[0]))
                
                # Create colored mask
                colored_mask = np.zeros_like(frame)
                color = np.random.randint(0, 255, 3).tolist()
                colored_mask[mask_resized > 0.5] = color
                
                # Blend with original frame
                annotated_frame = cv2.addWeighted(annotated_frame, 0.9, colored_mask, 0.2, 0)
        
        # Add custom navigation overlays
        annotated_frame = self._add_navigation_overlays(annotated_frame, analysis)
            
        return annotated_frame
    
    def _add_navigation_overlays(self, frame: np.ndarray, analysis: Dict) -> np.ndarray:
        """Add custom navigation-specific overlays to frame"""
        overlay_frame = frame.copy()
        
        # Count detected objects
        total_objects = analysis['total_detections']
        people_count = len([obj for obj in analysis['detected_objects'] if obj['class'] == 'person'])
        vehicle_count = len([obj for obj in analysis['detected_objects'] if obj['class'] in ['car', 'bus', 'truck', 'motorcycle']])
        
        # Add detection info indicator in top-left corner
        info_color = (0, 120, 255)  # Orange color for info
            
        # Draw info indicator
        cv2.rectangle(overlay_frame, (10, 10), (280, 80), info_color, -1)
        cv2.putText(overlay_frame, f"OBJECTS: {total_objects}", (20, 35), 
                   cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 255), 2)
        cv2.putText(overlay_frame, f"People: {people_count} | Vehicles: {vehicle_count}", (20, 55), 
                   cv2.FONT_HERSHEY_SIMPLEX, 0.4, (255, 255, 255), 1)
        
        return overlay_frame
    
    def save_frame(self, frame: np.ndarray, filepath: str) -> None:
        """Save frame to disk"""
        cv2.imwrite(filepath, frame)
    
    def generate_text_analysis(self, analysis: Dict, timestamp: float) -> str:
        """Generate human-readable scene description
        
        Args:
            analysis: Frame analysis results
            timestamp: Video timestamp in seconds
            
        Returns:
            Natural scene description
        """
        objects = analysis['detected_objects']
        
        # Filter objects by relevance
        nav_objects = [obj for obj in objects if obj['navigation_relevant']]
        
        # Count specific object types
        people_count = len([obj for obj in objects if obj['class'] == 'person'])
        vehicles = [obj for obj in objects if obj['class'] in ['car', 'bus', 'truck', 'motorcycle']]
        traffic_signals = [obj for obj in objects if obj['class'] in ['traffic light', 'stop sign']]
        bicycles = [obj for obj in objects if obj['class'] == 'bicycle']
        
        # Format timestamp
        time_str = f"{int(timestamp//60):02d}:{int(timestamp%60):02d}"
        
        # Generate simple scene description
        if not nav_objects:
            return f"[{time_str}] Clear view ahead with minimal activity."
        
        # Build description parts
        description_parts = []
        
        # People in scene
        if people_count > 0:
            if people_count == 1:
                description_parts.append("person visible")
            else:
                description_parts.append(f"{people_count} people in view")
        
        # Vehicles in scene
        if vehicles:
            vehicle_count = len(vehicles)
            vehicle_types = list(set([v['class'] for v in vehicles]))
            if vehicle_count == 1:
                description_parts.append(f"{vehicles[0]['class']} present")
            else:
                description_parts.append(f"{vehicle_count} vehicles ({', '.join(vehicle_types)})")
        
        # Bicycles
        if bicycles:
            bicycle_count = len(bicycles)
            if bicycle_count == 1:
                description_parts.append("cyclist nearby")
            else:
                description_parts.append(f"{bicycle_count} cyclists")
        
        # Traffic infrastructure
        if traffic_signals:
            signal_types = list(set([obj['class'] for obj in traffic_signals]))
            description_parts.append(f"traffic infrastructure: {', '.join(signal_types)}")
        
        # Determine scene type
        if vehicles and people_count > 3:
            scene_type = "Busy street"
        elif people_count > 0 and not vehicles:
            scene_type = "Pedestrian area" 
        elif vehicles:
            scene_type = "Traffic area"
        elif people_count > 0:
            scene_type = "Public space"
        else:
            scene_type = "Open area"
            
        # Construct final description
        if description_parts:
            description = f"[{time_str}] {scene_type}: " + ", ".join(description_parts) + "."
        else:
            description = f"[{time_str}] {scene_type} with minimal activity."
        
        return description
    
    def _assess_navigation_risk(self, people_count: int, vehicle_count: int, 
                              traffic_signals: List[Dict]) -> Tuple[str, List[str], str]:
        """Assess navigation risk and provide recommendations"""
        risk_factors = []
        
        # Analyze risk factors
        if vehicle_count >= 2:
            risk_level = "HIGH"
            risk_factors.append("heavy traffic")
        elif vehicle_count >= 1:
            risk_level = "MEDIUM" 
            risk_factors.append("vehicle traffic")
        else:
            risk_level = "LOW"
            
        if people_count > 4:
            risk_level = "HIGH" if risk_level == "MEDIUM" else "MEDIUM"
            risk_factors.append("crowded area")
        elif people_count > 1:
            risk_factors.append("pedestrian activity")
            
        if traffic_signals:
            risk_factors.append("traffic control active")
            
        # Generate navigation advice
        if risk_level == "HIGH":
            nav_advice = " Reduce speed, increase awareness."
        elif risk_level == "MEDIUM":
            nav_advice = " Maintain caution."
        else:
            nav_advice = " Clear for normal pace."
            
        return risk_level, risk_factors, nav_advice
    
    def get_navigation_summary(self, analysis: Dict) -> Dict:
        """Get summary statistics for a frame"""
        objects = analysis['detected_objects']
        
        people_count = len([obj for obj in objects if obj['class'] == 'person'])
        vehicle_count = len([obj for obj in objects if obj['class'] in ['car', 'bus', 'truck', 'motorcycle']])
        bicycle_count = len([obj for obj in objects if obj['class'] == 'bicycle'])
        
        return {
            'total_objects': len(objects),
            'people_count': people_count,
            'vehicle_count': vehicle_count,
            'bicycle_count': bicycle_count,
            'safety_critical_count': analysis['safety_objects_count']
        }
    
    def generate_session_summary(self, results: List[Dict]) -> Dict:
        """Generate overall session summary from all frames"""
        if not results:
            return {'status': 'no_data'}
            
        # Aggregate statistics
        total_frames = len(results)
        
        # Calculate averages
        avg_people = np.mean([r.get('navigation_summary', {}).get('people_count', 0) for r in results])
        avg_vehicles = np.mean([r.get('navigation_summary', {}).get('vehicle_count', 0) for r in results])
        avg_objects = np.mean([r.get('navigation_summary', {}).get('total_objects', 0) for r in results])
        
        # Count frames with activity
        frames_with_people = len([r for r in results if r.get('navigation_summary', {}).get('people_count', 0) > 0])
        frames_with_vehicles = len([r for r in results if r.get('navigation_summary', {}).get('vehicle_count', 0) > 0])
        
        # Determine session characteristics
        if avg_people > 2:
            session_type = "High Activity Social Environment"
        elif avg_vehicles > 1:
            session_type = "Vehicle-Heavy Urban Session"
        elif frames_with_people > total_frames * 0.5:
            session_type = "People-Focused Session"
        else:
            session_type = "Low Activity Open Environment"
            
        return {
            'session_type': session_type,
            'total_frames_analyzed': total_frames,
            'activity_distribution': {
                'frames_with_people': frames_with_people,
                'frames_with_vehicles': frames_with_vehicles,
                'frames_with_activity': len([r for r in results if r.get('navigation_summary', {}).get('total_objects', 0) > 0])
            },
            'average_people_per_frame': round(avg_people, 1),
            'average_vehicles_per_frame': round(avg_vehicles, 1),
            'average_objects_per_frame': round(avg_objects, 1),
            'model_info': 'YOLOv8n-seg (ultralytics)',
            'biometric_integration_notes': {
                'high_activity_moments': frames_with_people + frames_with_vehicles,
                'social_interaction_opportunities': frames_with_people,
                'environment_complexity': round(avg_objects, 1)
            }
        }