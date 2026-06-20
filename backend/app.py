"""
FastAPI inference server for the Traffic Violation Detection System.

Loads two YOLOv8 models (violation model + accident model), runs ensemble
inference on an uploaded image, draws bounding boxes, runs OCR on detected
number plates, and returns annotated image + structured JSON.

Deploy target: Hugging Face Spaces (Docker SDK) or Render.
"""

import io
import base64
import datetime
from typing import List, Optional

import cv2
import numpy as np
from PIL import Image
from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from ultralytics import YOLO
import easyocr

# ──────────────────────────────────────────────
# CONFIG
# ──────────────────────────────────────────────

VIOLATION_MODEL_PATH = "models/best.pt"
ACCIDENT_MODEL_PATH = "models/accident_best.pt"

VIOLATION_CLASSES = [
    "bus", "car", "motorcycle", "person", "truck",
    "Helmet", "NoHelmet", "crosswalk", "stop-line",
    "illegal_parking", "red-light", "numberplate",
]

# Classes that count as an actual "violation" for summary purposes
VIOLATION_LABELS = {
    "NoHelmet", "stop-line", "illegal_parking", "red-light",
}

CONF_THRESHOLDS = {
    "NoHelmet": 0.80,        # raised after real-world testing showed false positives
    "stop-line": 0.30,
    "crosswalk": 0.30,
    "illegal_parking": 0.40,
    "red-light": 0.40,
    "numberplate": 0.30,
    "Accident": 0.45,
    "default": 0.40,
}

# Reject accident boxes that cover too much of the frame (likely false positive)
MAX_ACCIDENT_BOX_AREA_RATIO = 0.40

COLORS = {
    "bus": (0, 128, 255), "car": (0, 128, 255), "motorcycle": (0, 128, 255),
    "person": (0, 200, 255), "truck": (0, 128, 255),
    "Helmet": (0, 200, 0), "NoHelmet": (0, 0, 255),
    "crosswalk": (0, 255, 255), "stop-line": (255, 255, 0),
    "illegal_parking": (0, 0, 255), "red-light": (0, 0, 200),
    "numberplate": (255, 0, 255), "Accident": (0, 0, 255),
}

# ──────────────────────────────────────────────
# LOAD MODELS (once, at startup)
# ──────────────────────────────────────────────

print("Loading violation model...")
violation_model = YOLO(VIOLATION_MODEL_PATH)

print("Loading accident model...")
accident_model = YOLO(ACCIDENT_MODEL_PATH)

print("Loading OCR reader...")
ocr_reader = easyocr.Reader(["en"], gpu=False)

print("All models loaded.")

# ──────────────────────────────────────────────
# APP SETUP
# ──────────────────────────────────────────────

app = FastAPI(title="Traffic Violation Detection API")

# Allow your Lovable frontend domain to call this API.
# For the hackathon, "*" is simplest; tighten this once you have your
# Lovable app's deployed URL.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


class Detection(BaseModel):
    type: str
    confidence: float
    bbox: List[int]


class PredictResponse(BaseModel):
    annotated_image_base64: str
    detections: List[Detection]
    plate_number: Optional[str]
    has_accident: bool
    timestamp: str


# ──────────────────────────────────────────────
# HELPERS
# ──────────────────────────────────────────────

def get_conf(cls_name: str) -> float:
    return CONF_THRESHOLDS.get(cls_name, CONF_THRESHOLDS["default"])


def is_reasonable_accident_box(x1, y1, x2, y2, img_w, img_h) -> bool:
    box_area = (x2 - x1) * (y2 - y1)
    img_area = img_w * img_h
    if img_area == 0:
        return False
    return (box_area / img_area) < MAX_ACCIDENT_BOX_AREA_RATIO


def run_ocr_on_plate(img_bgr: np.ndarray, bbox: List[int]) -> Optional[str]:
    x1, y1, x2, y2 = bbox
    # pad the crop slightly for better OCR
    pad = 4
    h, w = img_bgr.shape[:2]
    x1, y1 = max(0, x1 - pad), max(0, y1 - pad)
    x2, y2 = min(w, x2 + pad), min(h, y2 + pad)
    crop = img_bgr[y1:y2, x1:x2]

    if crop.size == 0:
        return None

    try:
        results = ocr_reader.readtext(crop)
        if not results:
            return None
        # concatenate all detected text fragments, highest confidence first
        results.sort(key=lambda r: -r[2])
        text = " ".join([r[1] for r in results])
        return text.strip().upper() if text.strip() else None
    except Exception:
        return None


def draw_box(img: np.ndarray, x1, y1, x2, y2, label: str, conf: float, color):
    cv2.rectangle(img, (x1, y1), (x2, y2), color, 2)
    text = f"{label} {conf:.2f}"
    (tw, th), _ = cv2.getTextSize(text, cv2.FONT_HERSHEY_SIMPLEX, 0.55, 2)
    cv2.rectangle(img, (x1, max(0, y1 - th - 8)), (x1 + tw, y1), color, -1)
    cv2.putText(img, text, (x1, max(12, y1 - 6)),
                cv2.FONT_HERSHEY_SIMPLEX, 0.55, (255, 255, 255), 2)


def image_to_base64(img_bgr: np.ndarray) -> str:
    success, buffer = cv2.imencode(".jpg", img_bgr)
    if not success:
        raise RuntimeError("Failed to encode annotated image")
    return base64.b64encode(buffer).decode("utf-8")


# ──────────────────────────────────────────────
# CORE INFERENCE
# ──────────────────────────────────────────────

def run_inference(img_bgr: np.ndarray):
    h, w = img_bgr.shape[:2]
    detections = []
    plate_number = None
    has_accident = False

    # ---- violation model ----
    # imgsz=960 (higher than default 640) — improves detection of small
    # objects like number plates on real-world unseen images
    v_results = violation_model(img_bgr, conf=0.15, imgsz=960, verbose=False)[0]
    for box in v_results.boxes:
        cls_name = VIOLATION_CLASSES[int(box.cls)]
        conf = float(box.conf)
        if conf < get_conf(cls_name):
            continue

        x1, y1, x2, y2 = map(int, box.xyxy[0])
        detections.append({
            "type": cls_name, "confidence": round(conf, 3),
            "bbox": [x1, y1, x2, y2],
        })

        if cls_name == "numberplate" and plate_number is None:
            plate_number = run_ocr_on_plate(img_bgr, [x1, y1, x2, y2])

    # ---- accident model ----
    a_results = accident_model(img_bgr, conf=0.15, imgsz=960, verbose=False)[0]
    for box in a_results.boxes:
        conf = float(box.conf)
        if conf < get_conf("Accident"):
            continue

        x1, y1, x2, y2 = map(int, box.xyxy[0])
        if not is_reasonable_accident_box(x1, y1, x2, y2, w, h):
            continue

        detections.append({
            "type": "Accident", "confidence": round(conf, 3),
            "bbox": [x1, y1, x2, y2],
        })
        has_accident = True

    # ---- draw all boxes on a copy of the image ----
    annotated = img_bgr.copy()
    for det in detections:
        x1, y1, x2, y2 = det["bbox"]
        color = COLORS.get(det["type"], (200, 200, 200))
        draw_box(annotated, x1, y1, x2, y2, det["type"], det["confidence"], color)

    return annotated, detections, plate_number, has_accident


# ──────────────────────────────────────────────
# ROUTES
# ──────────────────────────────────────────────

@app.get("/")
def root():
    return {"status": "ok", "message": "Traffic Violation Detection API is running"}


@app.get("/health")
def health():
    return {"status": "healthy"}


@app.post("/predict", response_model=PredictResponse)
async def predict(file: UploadFile = File(...)):
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="File must be an image")

    contents = await file.read()
    try:
        pil_img = Image.open(io.BytesIO(contents)).convert("RGB")
    except Exception:
        raise HTTPException(status_code=400, detail="Could not read image file")

    img_bgr = cv2.cvtColor(np.array(pil_img), cv2.COLOR_RGB2BGR)

    annotated, detections, plate_number, has_accident = run_inference(img_bgr)

    return PredictResponse(
        annotated_image_base64=image_to_base64(annotated),
        detections=[Detection(**d) for d in detections],
        plate_number=plate_number,
        has_accident=has_accident,
        timestamp=datetime.datetime.utcnow().isoformat() + "Z",
    )
