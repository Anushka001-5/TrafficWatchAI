---
title: Traffic Violation Detection API
emoji: 🚦
colorFrom: blue
colorTo: red
sdk: docker
app_port: 7860
---

# Traffic Violation Detection API

FastAPI inference server combining two YOLOv8 models:
- Violation model (12 classes: vehicles, helmet compliance, stop-line,
  illegal parking, red-light, crosswalk, numberplate)
- Accident detection model

## Endpoints

- `GET /` — health check
- `GET /health` — health check
- `POST /predict` — upload an image (`file` field, multipart/form-data),
  returns annotated image (base64) + structured detection JSON

## Setup

Place your trained weights in `models/`:
```
models/best.pt
models/accident_best.pt
```
