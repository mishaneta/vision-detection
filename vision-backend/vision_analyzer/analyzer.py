import cv2
import numpy as np
from ultralytics import YOLO
import torch
from typing import Dict

class VisionAnalyzer:
    """Real-time video analysis using YOLOv8"""
    
    def __init__(self):
        """Initialize the analyzer with YOLOv8 model"""
        # Initialize YOLOv8 model
        self.model = YOLO('yolov8n.pt')  # nano version for speed
        
        # COCO class names
        self.class_names = self.model.names
        
        print(f"🔧 Initialized VisionAnalyzer with YOLOv8")
        print(f"📱 Device: {'CUDA' if torch.cuda.is_available() else 'CPU'}")
        
    def analyze_frame(self, frame: np.ndarray) -> Dict:
        """Analyze single frame for objects using YOLOv8
        
        Args:
            frame: Input frame as numpy array
            
        Returns:
            Dictionary containing detection results
        """
        print(f"\n🔍 === FRAME ANALYSIS START ===")
        print(f"📏 Frame dimensions: {frame.shape}")
        
        # Run YOLOv8 inference
        results = self.model(frame, verbose=False)
        result = results[0]
        
        # Parse detected objects
        detected_objects = []
        
        if result.boxes is not None and len(result.boxes) > 0:
            boxes = result.boxes.xyxy.cpu().numpy()  # x1, y1, x2, y2
            scores = result.boxes.conf.cpu().numpy()  # confidence scores
            classes = result.boxes.cls.cpu().numpy().astype(int)  # class indices
            
            print(f"🎯 Total detections: {len(boxes)}")
            print(f"📊 Detection details:")
            
            for i, (box, score, cls_id) in enumerate(zip(boxes, scores, classes)):
                class_name = self.class_names[cls_id]
                center_x = (box[0] + box[2]) / 2
                center_y = (box[1] + box[3]) / 2
                width = box[2] - box[0]
                height = box[3] - box[1]
                
                print(f"  [{i+1}] 🏷️  {class_name} ({score:.3f}) - Box: [{box[0]:.1f}, {box[1]:.1f}, {box[2]:.1f}, {box[3]:.1f}] - Size: {width:.1f}x{height:.1f} - Center: ({center_x:.1f}, {center_y:.1f})")
                
                detected_objects.append({
                    'id': i,
                    'class': class_name,
                    'confidence': float(score),
                    'bbox': box.tolist(),  # [x1, y1, x2, y2]
                    'center': [center_x, center_y]
                })
        else:
            print(f"❌ No objects detected in this frame")
        
        analysis_result = {
            'detected_objects': detected_objects,
            'total_detections': len(detected_objects)
        }
        
        print(f"✅ Analysis complete: {len(detected_objects)} objects detected")
        print(f"🔍 === FRAME ANALYSIS END ===\n")
        
        return analysis_result
    
    def generate_scene_description(self, analysis: Dict, timestamp: float) -> str:
        """Generate human-readable scene description
        
        Args:
            analysis: Frame analysis results
            timestamp: Video timestamp in seconds
            
        Returns:
            Natural scene description
        """
        print(f"\n📝 === GENERATING SCENE DESCRIPTION ===")
        print(f"⏰ Timestamp: {timestamp:.2f}s")
        
        objects = analysis['detected_objects']
        
        if not objects:
            description = f"Clear view with no detected objects"
            print(f"📄 Description: {description}")
            print(f"📝 === SCENE DESCRIPTION END ===\n")
            return description
        
        # Count objects by type
        object_counts = {}
        for obj in objects:
            class_name = obj['class']
            object_counts[class_name] = object_counts.get(class_name, 0) + 1
        
        print(f"📈 Object counts: {object_counts}")
        
        # Build natural description
        description_parts = []
        
        # People
        if 'person' in object_counts:
            count = object_counts['person']
            if count == 1:
                description_parts.append("1 person")
            else:
                description_parts.append(f"{count} people")
            print(f"👥 People detected: {count}")
        
        # Vehicles
        vehicle_types = ['car', 'truck', 'bus', 'motorcycle', 'bicycle']
        vehicles = []
        for vtype in vehicle_types:
            if vtype in object_counts:
                count = object_counts[vtype]
                if count == 1:
                    vehicles.append(f"1 {vtype}")
                else:
                    vehicles.append(f"{count} {vtype}s")
                print(f"🚗 {vtype.capitalize()}s detected: {count}")
        
        if vehicles:
            if len(vehicles) == 1:
                description_parts.append(vehicles[0])
            else:
                description_parts.append(", ".join(vehicles[:-1]) + f" and {vehicles[-1]}")
        
        # Other notable objects
        other_objects = []
        skip_types = ['person'] + vehicle_types
        for obj_type, count in object_counts.items():
            if obj_type not in skip_types:
                if count == 1:
                    other_objects.append(f"1 {obj_type}")
                else:
                    other_objects.append(f"{count} {obj_type}s")
                print(f"📦 Other object - {obj_type}: {count}")
        
        if other_objects and len(other_objects) <= 3:
            description_parts.append(", ".join(other_objects))
        
        # Create scene description
        if not description_parts:
            description = "Scene with various objects detected"
        else:
            # Determine scene type based on what's detected
            scene_context = ""
            if 'person' in object_counts and any(v in object_counts for v in vehicle_types):
                scene_context = "Street scene with "
                print(f"🏙️  Scene type: Street scene")
            elif 'person' in object_counts and object_counts['person'] > 2:
                scene_context = "Busy area with "
                print(f"👥 Scene type: Busy area")
            elif any(v in object_counts for v in vehicle_types):
                scene_context = "Traffic view showing "
                print(f"🚦 Scene type: Traffic view")
            else:
                scene_context = "View showing "
                print(f"👁️  Scene type: General view")
            
            description = scene_context + ", ".join(description_parts)
        
        print(f"📄 Final description: '{description}'")
        print(f"📝 === SCENE DESCRIPTION END ===\n")
        
        return description