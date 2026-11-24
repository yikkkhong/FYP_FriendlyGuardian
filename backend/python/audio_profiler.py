"""Estimate a speech profile from an audio file and an optional word count."""

import json
import sys


# Heuristic cutoffs for pause fraction and relative RMS variation.
MODERATE_PAUSE = 0.25
HIGH_PAUSE = 0.45
HIGH_TREMOR = 0.30


def classify(wpm, pause_ratio, tremor_score):
    # tier 3
    if 0 < wpm < 110:
        return 3, "very_elderly", "Speaking rate below 110 WPM."
        
    if wpm < 95 and pause_ratio >= HIGH_PAUSE:
        return 3, "very_elderly", "High pause ratio with low or unavailable WPM."
    
    if wpm < 95 and tremor_score >= HIGH_TREMOR:
        return 3, "very_elderly", "High energy variation with low or unavailable WPM."
    
    if 80 <= wpm < 110:
        return 2, "senior", "Speaking rate from 80 to under 110 WPM."
    
    if pause_ratio >= MODERATE_PAUSE:
        return 2, "senior", "At least a quarter of the recording is silent."
    
    return 1, "standard", "Speech metrics fall below the profile triggers."


def profile_audio(audio_path, word_count):
    import librosa
    import numpy as np

    samples, sr = librosa.load(audio_path, sr=22050, mono=True)
    duration_sec = samples.size / sr
    wpm = (word_count / duration_sec) * 60 if duration_sec > 0 else 0.0
    frame_length, hop_length = 512, 256
    active_samples = 0
    voiced_rms = []

    # split() uses a peak-relative threshold, so handle digital silence first.
    if np.any(samples):
        intervals = librosa.effects.split(
            samples, top_db=30, frame_length=frame_length, hop_length=hop_length
        )
        for start, end in intervals:
            active_samples += int(end - start)
            if end - start >= frame_length:
                rms = librosa.feature.rms(
                    y=samples[start:end], frame_length=frame_length,
                    hop_length=hop_length, center=False,
                )
                voiced_rms.append(rms.ravel())

    pause_ratio = 1.0 - active_samples / samples.size if samples.size else 0.0
    tremor_score = 0.0
    if voiced_rms:
        # Relative RMS spread is independent of the recording's overall gain.
        energy = np.concatenate(voiced_rms).astype(np.float64)
        mean_rms = energy.mean()
        if mean_rms > 0:
            tremor_score = float(energy.std() / mean_rms)

    tier, profile, reason = classify(wpm, pause_ratio, tremor_score)
    return {
        "success": True, "tier": tier, "profile": profile, "wpm": wpm,
        "pauseRatio": pause_ratio, "tremorScore": tremor_score, "reason": reason,
    }


def main():
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    try:
        if len(sys.argv) not in (2, 3):
            raise ValueError("Usage: audio_profiler.py audio_path [word_count]")
        word_count = int(sys.argv[2]) if len(sys.argv) == 3 else 0
        if word_count < 0:
            raise ValueError("word_count must be nonnegative")
        result = profile_audio(sys.argv[1], word_count)
        print(json.dumps(result, allow_nan=False))
        return 0
    except Exception as exc:
        print(json.dumps({
            "success": False, "tier": 1, "profile": "standard",
            "error": str(exc) or type(exc).__name__,
        }))
        return 1


if __name__ == "__main__":
    sys.exit(main())
