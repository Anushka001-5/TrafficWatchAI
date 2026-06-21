# Automated Photo Identification and Classification for Traffic Violations Using Computer Vision

An AI-based traffic image analysis system that automatically detects vehicles
and road users, identifies traffic violations, classifies violation types,
recognizes license plates, and generates annotated evidence for enforcement
review - built for the Flipkart Gridlock Hackathon under the Computer Vision
problem statement.

## Live Links

- **Live App (Frontend):** https://trafficvisionai.lovable.app
- **Live ML API (Backend):** https://kuhu-01-traffic-backend.hf.space
- ## Demo Access (Police Portal)
Email: demo.police@trafficvisionai.com
Password: demo@2026
Note: Pre-provisioned demo account for evaluation purposes.

## Repository Structure

```
traffic-violation-detection/
├── frontend/      React + Supabase app (built with Lovable)
│                  Citizen Portal + Traffic Police Portal
└── backend/       FastAPI ML inference server
                   Ensemble of two fine-tuned YOLOv8 models
```

## 🧠 System Architecture

```
User uploads traffic image (Citizen or Police Portal)
        │
        ▼
Frontend (React + Supabase) — captures location, sends image
        │
        │  POST /predict
        ▼
Backend API (FastAPI, hosted on Hugging Face Spaces)
        │
        ├── Violation Model (YOLOv8n, 12 classes)
        │     bus, car, motorcycle, person, truck,
        │     Helmet, NoHelmet, crosswalk, stop-line,
        │     illegal_parking, red-light, numberplate
        │
        ├── Accident Detection Model (YOLOv8n, 1 class)
        │
        └── EasyOCR — reads detected number plates
        │
        ▼
Returns: annotated image (bounding boxes) + structured JSON
(violation types, confidence scores, plate number, accident flag)
        │
        ▼
Frontend saves result to Supabase `violation_records` table
        │
        ▼
Displayed across: Violation Log, Analytics Dashboard,
Accident Heatmap, Chalan History
```

## ✨ Features

**Citizen Portal**
- Upload a traffic image with location tagging
- View instant AI-annotated violation detection results
- Track personal chalan history with payment status

**Traffic Police Portal**
- All citizen features, plus:
- Searchable & filterable violation log (by type, date, plate number, status)
- Analytics dashboard — violations by type, by hour, trend over time
- Accident-prone area heatmap with incident details
- Full chalan management — issue, view, and update status across all
  citizens with location and timestamp

## Machine Learning

**Violation Model**
- Architecture: YOLOv8n (Ultralytics), fine-tuned
- Training data: merged dataset of ~5,200 images from 6 public Roboflow
  sources (helmet compliance, stop-line, illegal parking, red-light,
  person & vehicle, license plate)
- Validation results: mAP50 0.735, mAP50-95 0.445, Precision 0.765,
  Recall 0.717
- Per-class breakdown available in `backend/training_results.md`

**Accident Detection Model**
- Architecture: YOLOv8n, trained separately on a 3,250-image accident
  detection dataset
- Combined with the violation model via ensemble inference (both models
  run on every uploaded image; results merged and rendered together)

**License Plate Recognition**
- EasyOCR applied to cropped number-plate detections from the violation
  model

## ⚠️ Known Limitations (honest disclosure)

- Vehicle/pedestrian classes (car, bus, motorcycle, truck, person) show
  strong validation performance but reduced generalization on images from
  camera sources/styles outside the training distribution — a known
  domain-gap limitation common in prototype-stage models trained on
  CCTV-style footage from a single source. Apart from this, accident detection
  may also show reduced generalization due to lack of refined dataset
- Triple riding and wrong-side driving are not implemented in this version,
  as they require video-based temporal analysis (multi-frame tracking)
  rather than single-image detection; no suitable public dataset exists for
  either at this time. The system architecture is extensible to support
  these once video stream input is available.
- Seatbelt detection was scoped out due to lack of clean, India-relevant
  public training data within the project timeline.
- Stop-line and crosswalk classes have comparatively lower validation mAP
  (0.31 and 0.22) due to smaller training sample sizes; the system
  compensates using a fixed ROI-based zone check as a secondary signal.

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React, Supabase (Auth, Database, Storage), Lovable |
| Backend | FastAPI, Python |
| ML | YOLOv8 (Ultralytics), OpenCV, EasyOCR |
| Hosting | Hugging Face Spaces (backend), [Lovable/Vercel] (frontend) |
| Maps | Leaflet + OpenStreetMap |
| Training | Google Colab (T4 GPU) |

## 🚀 Running Locally

### Backend
```bash
cd backend
pip install -r requirements.txt
# place best.pt and accident_best.pt inside backend/models/
uvicorn app:app --host 0.0.0.0 --port 7860
```

### Frontend
```bash
cd frontend
npm install
npm run dev
```

## 👥 Team

Team Neural Sprint
Anushka Sharma (Team Leader)
Kashvi Dashore
Anshika Sahu
