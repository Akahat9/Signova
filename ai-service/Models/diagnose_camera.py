"""Identify a Windows camera index/backend that actually yields video frames."""

from __future__ import annotations

import argparse
import os
import time

import cv2


def candidates(backend: str):
    if backend == "dshow":
        return [("dshow", cv2.CAP_DSHOW)]
    if backend == "msmf":
        return [("msmf", cv2.CAP_MSMF)]
    if backend == "any":
        return [("any", None)]
    if os.name == "nt":
        return [("dshow", cv2.CAP_DSHOW), ("msmf", cv2.CAP_MSMF), ("any", None)]
    return [("any", None)]


def check(index: int, name: str, api: int | None, seconds: float) -> dict:
    camera = cv2.VideoCapture(index) if api is None else cv2.VideoCapture(index, api)
    result = {"camera": index, "backend": name, "opened": camera.isOpened(), "frames": 0}
    if not camera.isOpened():
        return result
    camera.set(cv2.CAP_PROP_FRAME_WIDTH, 1280)
    camera.set(cv2.CAP_PROP_FRAME_HEIGHT, 720)
    deadline = time.perf_counter() + seconds
    sample = None
    while time.perf_counter() < deadline:
        ok, frame = camera.read()
        if ok:
            result["frames"] += 1
            sample = frame
    camera.release()
    if sample is not None:
        result.update({
            "width": int(sample.shape[1]),
            "height": int(sample.shape[0]),
            "mean_brightness": round(float(sample.mean()), 2),
            "status": "usable" if result["frames"] >= 15 else "stream_unstable",
        })
    else:
        result["status"] = "no_frames"
    return result


def main() -> None:
    parser = argparse.ArgumentParser(description="Probe local camera devices for usable OpenCV frames.")
    parser.add_argument("--max-index", type=int, default=4)
    parser.add_argument("--backend", choices=["auto", "dshow", "msmf", "any"], default="auto")
    parser.add_argument("--seconds", type=float, default=2.0)
    args = parser.parse_args()
    for index in range(args.max_index + 1):
        for name, api in candidates(args.backend):
            result = check(index, name, api, args.seconds)
            print(result)


if __name__ == "__main__":
    main()
