"""
SignBridge FastAPI Backend - Complete Rewrite
Key logic:
- After each confirmed word: buffer clears completely + 20-frame cooldown
- After hand disappears for 6 frames: buffer clears completely
- No majority voting (was causing stale predictions)
- Single clean prediction per gesture cycle
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from keras.models import load_model
import numpy as np
import base64
import cv2
import mediapipe as mp
import pickle
from collections import deque

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

model = load_model("model/best_model.h5")
print("✅ Model loaded:", model.input_shape, "→", model.output_shape)

NUM_CLASSES = model.output_shape[-1]

with open("model/final_dataset.pkl", "rb") as f:
    data = pickle.load(f)

idx_to_word = data.get("idx_to_word")
camera_flip = data.get("camera_flip", True)
labels      = [idx_to_word[i] for i in range(len(idx_to_word))]
if len(labels) < NUM_CLASSES:
    labels += [f"Class_{i}" for i in range(len(labels), NUM_CLASSES)]
labels      = list(labels)
unknown_idx = next((i for i, w in idx_to_word.items() if w == "__UNKNOWN__"), None)

print(f"✅ Labels: {labels}")
print(f"✅ camera_flip={camera_flip}, unknown_idx={unknown_idx}")

mp_hands       = mp.solutions.hands
hands_detector = mp_hands.Hands(
    static_image_mode=False,
    max_num_hands=2,
    min_detection_confidence=0.5,
    min_tracking_confidence=0.5
)

SEQUENCE_LENGTH     = 30
MIN_CONFIDENCE      = 0.75
COOLDOWN_AFTER_PRED = 20   # frames to skip after a word is sent
NO_HAND_RESET_AT    = 6    # frames of no-hand before buffer reset

# Global mutable state
state = {
    "buffer":       deque(maxlen=SEQUENCE_LENGTH),
    "no_hand":      0,
    "cooldown":     0,
    "last_word":    "",
}


def decode_image(b64: str):
    try:
        if "," in b64:
            b64 = b64.split(",")[1]
        arr = np.frombuffer(base64.b64decode(b64), np.uint8)
        img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
        if not camera_flip:
            img = cv2.flip(img, 1)
        return img
    except Exception as e:
        print("decode err:", e)
        return None


def extract_landmarks(results):
    lm = np.zeros(126, dtype=np.float32)
    if results.multi_hand_landmarks:
        h1 = np.array([[p.x, p.y, p.z]
                        for p in results.multi_hand_landmarks[0].landmark])
        h1 -= h1[0]
        lm[0:63] = h1.flatten()
        if len(results.multi_hand_landmarks) == 2:
            h2 = np.array([[p.x, p.y, p.z]
                            for p in results.multi_hand_landmarks[1].landmark])
            h2 -= h2[0]
            lm[63:126] = h2.flatten()
    return lm


def hard_reset(reason=""):
    state["buffer"].clear()
    state["no_hand"]   = 0
    state["cooldown"]  = 0
    state["last_word"] = ""
    if reason:
        print(f"🔄 Reset: {reason}")


@app.post("/predict")
async def predict(req: dict):
    try:
        img = decode_image(req.get("image", ""))
        if img is None:
            return {"prediction": "...", "confidence": 0}

        results    = hands_detector.process(cv2.cvtColor(img, cv2.COLOR_BGR2RGB))
        hand_found = bool(results.multi_hand_landmarks)

        # ── No hand detected ──────────────────────────────────────────────────
        if not hand_found:
            state["no_hand"] += 1
            if state["no_hand"] >= NO_HAND_RESET_AT:
                hard_reset("no hand")
            return {"prediction": "...", "confidence": 0}

        state["no_hand"] = 0

        # Buffer the frame
        state["buffer"].append(extract_landmarks(results))

        # Still collecting
        n = len(state["buffer"])
        if n < SEQUENCE_LENGTH:
            return {
                "prediction": f"Collecting {n}/{SEQUENCE_LENGTH}",
                "confidence": 0
            }

        # In cooldown after previous word
        if state["cooldown"] > 0:
            state["cooldown"] -= 1
            return {"prediction": "...", "confidence": 0}

        # ── Predict ───────────────────────────────────────────────────────────
        seq   = np.expand_dims(np.array(state["buffer"]), 0).astype(np.float32)
        probs = model.predict(seq, verbose=0)[0]
        cid   = int(np.argmax(probs))
        conf  = float(probs[cid])
        word  = labels[cid] if cid < len(labels) else "?"

        # Debug
        top = np.argsort(probs)[::-1][:3]
        print("─" * 32)
        for i in top:
            print(f"  {(labels[i] if i < len(labels) else '?'):<14} {probs[i]:.3f}")

        if cid == unknown_idx:
            return {"prediction": "...", "confidence": 0}

        if conf < MIN_CONFIDENCE:
            print(f"  → low conf {conf:.2f}")
            return {"prediction": "...", "confidence": round(conf, 2)}

        # ── Confirmed word ────────────────────────────────────────────────────
        print(f"  ✅ {word} ({conf:.2f})")
        state["last_word"] = word

        # HARD RESET buffer so next sign starts completely fresh
        state["buffer"].clear()
        # Start cooldown — ignore next N frames even if hand still there
        state["cooldown"] = COOLDOWN_AFTER_PRED

        return {"prediction": word, "confidence": round(conf, 2)}

    except Exception as e:
        import traceback
        traceback.print_exc()
        return {"prediction": "Error", "confidence": 0}


@app.post("/reset")
async def reset():
    hard_reset("manual")
    return {"status": "reset"}


@app.get("/status")
async def get_status():
    return {
        "buffer":    len(state["buffer"]),
        "cooldown":  state["cooldown"],
        "last_word": state["last_word"],
        "no_hand":   state["no_hand"],
    }


@app.get("/labels")
async def get_labels():
    return {"labels": [l for l in labels if l != "__UNKNOWN__"]}