"""Generate the deterministic CC0 'upbeat' shared BGM loop for XinOne.

Synthesizes a short chiptune-style arpeggio loop (square-wave melody over a
square-wave bass pulse) at 22.05kHz, mono, 16-bit PCM. Re-running this script
produces a byte-identical file.
"""
import math
import struct
import wave
from pathlib import Path

SAMPLE_RATE = 22050
BPM = 150
EIGHTH_SECONDS = 60.0 / BPM / 2.0
STEPS = 64
AMPLITUDE = 0.22

# C major pentatonic across two octaves: C D E G A C D E
SCALE = [261.63, 293.66, 329.63, 392.00, 440.00, 523.25, 587.33, 659.25]
BASS_NOTE = 130.81  # C3

MELODY_BAR_A = [0, 2, 4, 2, 1, 3, 5, 3]
MELODY_BAR_B = [4, 6, 7, 6, 4, 2, 1, 0]
PATTERN = (MELODY_BAR_A + MELODY_BAR_A + MELODY_BAR_B + MELODY_BAR_B) * 2

OUTPUT_PATH = Path(__file__).resolve().parents[2] / "packages/shared-assets/assets/audio/bgm/upbeat.wav"


def square_wave(frequency: float, t: float) -> float:
    phase = (t * frequency) % 1.0
    return 1.0 if phase < 0.5 else -1.0


def main() -> None:
    step_samples = int(SAMPLE_RATE * EIGHTH_SECONDS)
    total_samples = step_samples * STEPS
    samples = [0.0] * total_samples

    for step, scale_index in enumerate(PATTERN):
        frequency = SCALE[scale_index]
        start = step * step_samples
        for i in range(step_samples):
            t = i / SAMPLE_RATE
            envelope = math.exp(-4.0 * t)
            samples[start + i] += square_wave(frequency, t) * envelope * AMPLITUDE

    # Bass pulse on every bar (every 8 steps).
    bass_samples = step_samples * 2
    for step in range(0, STEPS, 8):
        start = step * step_samples
        for i in range(bass_samples):
            if start + i >= total_samples:
                break
            t = i / SAMPLE_RATE
            envelope = math.exp(-2.5 * t)
            samples[start + i] += square_wave(BASS_NOTE, t) * envelope * AMPLITUDE * 0.8

    pcm = [int(max(-1.0, min(1.0, value)) * 32767) for value in samples]

    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    with wave.open(str(OUTPUT_PATH), "wb") as handle:
        handle.setnchannels(1)
        handle.setsampwidth(2)
        handle.setframerate(SAMPLE_RATE)
        handle.writeframes(struct.pack(f"<{len(pcm)}h", *pcm))
    print(f"wrote {OUTPUT_PATH} ({len(pcm)} frames, {len(pcm) / SAMPLE_RATE:.2f}s)")


if __name__ == "__main__":
    main()
