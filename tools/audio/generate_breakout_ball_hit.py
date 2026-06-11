"""Generate the deterministic CC0 'ball-hit' sound effect for games/breakout.

Synthesizes a short arcade-style blip: a fast-decaying sine tone with a
touch of filtered noise for a percussive click, mono 16-bit PCM at 44.1kHz.
Re-running this script produces a byte-identical file.
"""
import math
import random
import struct
import wave
from pathlib import Path

SAMPLE_RATE = 44100
DURATION_SECONDS = 0.09
TONE_FREQUENCY = 1100.0
DECAY = 28.0
NOISE_AMOUNT = 0.18
AMPLITUDE = 0.6

OUTPUT_PATH = Path(__file__).resolve().parents[2] / "games/breakout/assets/audio/sfx/ball-hit.wav"


def generate_samples() -> list[int]:
    rng = random.Random(20260612)
    total_frames = int(SAMPLE_RATE * DURATION_SECONDS)
    samples = []
    for i in range(total_frames):
        t = i / SAMPLE_RATE
        envelope = math.exp(-DECAY * t)
        tone = math.sin(2 * math.pi * TONE_FREQUENCY * t)
        noise = (rng.random() * 2 - 1) * NOISE_AMOUNT
        value = (tone + noise) * envelope * AMPLITUDE
        value = max(-1.0, min(1.0, value))
        samples.append(int(value * 32767))
    return samples


def main() -> None:
    samples = generate_samples()
    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    with wave.open(str(OUTPUT_PATH), "wb") as handle:
        handle.setnchannels(1)
        handle.setsampwidth(2)
        handle.setframerate(SAMPLE_RATE)
        handle.writeframes(struct.pack(f"<{len(samples)}h", *samples))
    print(f"wrote {OUTPUT_PATH} ({len(samples)} frames)")


if __name__ == "__main__":
    main()
