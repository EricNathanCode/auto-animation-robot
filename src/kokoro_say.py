# Auto Animate · Kokoro voices (free, offline, Apache-2.0): makes many lines in one go, so the model loads only once.
# python -I kokoro_say.py <kokoro-v1.0.onnx> <voices-v1.0.bin> <jobs.json>
# jobs.json = [{"text": "...", "voice": "am_michael", "speed": 1.0, "lang": "en-us", "out": "C:/.../line.wav"}, ...]
import json
import sys

import soundfile as sf
from kokoro_onnx import Kokoro


def main():
    model, voices, jobs_file = sys.argv[1], sys.argv[2], sys.argv[3]
    with open(jobs_file, encoding="utf-8") as f:
        jobs = json.load(f)
    kokoro = Kokoro(model, voices)
    for job in jobs:
        voice = job["voice"]
        lang = job.get("lang") or ("en-gb" if voice[:1] == "b" else "en-us")
        samples, rate = kokoro.create(job["text"], voice=voice, speed=float(job.get("speed", 1.0)), lang=lang)
        sf.write(job["out"], samples, rate)
        print(f"ok {job['out']}", flush=True)


if __name__ == "__main__":
    main()
