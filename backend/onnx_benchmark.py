import cv2
import numpy as np
import onnxruntime as ort
import time
from concurrent.futures import ProcessPoolExecutor
import os
import psutil

MODEL_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'Paprika_54.onnx')

# Generate dummy frames for benchmarking
def generate_dummy_frames(num_frames=32, width=256, height=256):
    return [np.random.randint(0, 256, (height, width, 3), dtype=np.uint8) for _ in range(num_frames)]

def preprocess(frame):
    # Resize to multiple of 32, normalize, convert to RGB, etc.
    h, w = frame.shape[:2]
    frame = cv2.resize(frame, (w - w % 32, h - h % 32))
    frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB).astype(np.float32) / 127.5 - 1.0
    return np.expand_dims(frame, 0)

def run_onnx_single(frame):
    session = ort.InferenceSession(MODEL_PATH, providers=['CPUExecutionProvider'])
    x = session.get_inputs()[0].name
    return session.run(None, {x: preprocess(frame)})[0]

def run_onnx_batch(frames):
    session = ort.InferenceSession(MODEL_PATH, providers=['CPUExecutionProvider'])
    x = session.get_inputs()[0].name
    # Stack frames for batch
    batch = np.concatenate([preprocess(f) for f in frames], axis=0)
    return session.run(None, {x: batch})[0]

def multiprocessing_worker(frame):
    return run_onnx_single(frame)

def benchmark_single(frames):
    print("Benchmarking single-frame (no parallelism)...")
    start = time.time()
    for f in frames:
        run_onnx_single(f)
    elapsed = time.time() - start
    print(f"Single-frame total: {elapsed:.2f}s, per frame: {elapsed/len(frames):.3f}s")
    return elapsed

def benchmark_batch(frames, batch_size):
    print(f"Benchmarking batching (batch size {batch_size})...")
    start = time.time()
    for i in range(0, len(frames), batch_size):
        batch = frames[i:i+batch_size]
        run_onnx_batch(batch)
    elapsed = time.time() - start
    print(f"Batch total: {elapsed:.2f}s, per frame: {elapsed/len(frames):.3f}s")
    return elapsed

def benchmark_multiprocessing(frames, num_workers):
    print(f"Benchmarking multiprocessing ({num_workers} workers)...")
    start = time.time()
    with ProcessPoolExecutor(max_workers=num_workers) as executor:
        list(executor.map(multiprocessing_worker, frames))
    elapsed = time.time() - start
    print(f"Multiprocessing total: {elapsed:.2f}s, per frame: {elapsed/len(frames):.3f}s")
    return elapsed

def main():
    num_frames = 16  # Adjust for your RAM/CPU
    width, height = 256, 256  # Adjust for your typical video resolution
    frames = generate_dummy_frames(num_frames, width, height)
    print(f"CPU cores: {psutil.cpu_count(logical=True)}")
    print(f"RAM: {round(psutil.virtual_memory().total/1e9, 2)} GB")
    
    # Single-frame
    benchmark_single(frames)
    # Batch (if model supports it)
    try:
        benchmark_batch(frames, batch_size=4)
    except Exception as e:
        print(f"Batching failed: {e}")
    # Multiprocessing
    benchmark_multiprocessing(frames, num_workers=min(4, os.cpu_count() or 2))

if __name__ == "__main__":
    main()
