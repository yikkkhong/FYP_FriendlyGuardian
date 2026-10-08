# existing problem to fix
# if image is sent through whatsapp or other app, the compressed image will be detect as AI (cause noise mean is low)
# anime / drawing image will be detect as AI (cause no noise)
# improve accuracy for other image also

import os
import cv2
import numpy as np
import matplotlib.pyplot as plt

def extract_forensic_features(image_path: str) -> dict:
    """
    Extract multi-modal digital forensic features from the target image:
    1. Sensor Noise Residual (PRNU proxy): Captures physical camera noise.
    2. Spatial Noise Discrepancy: Detects localized smoothing or inpainting.
    3. 2D-FFT Frequency Ratio: Identifies spectral anomalies and boundary artifacts.
    """
    img_bgr = cv2.imread(image_path)
    if img_bgr is None:
        raise FileNotFoundError(f"Failed to read image at: {image_path}")

    gray = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2GRAY)
    h, w = gray.shape

    # --- 1. Noise Residual Analysis ---
    # Real camera sensors produce physical shot noise (Gaussian/Poisson distributed).
    # AI models (Diffusion/GAN) produce synthetic textures lacking sensor noise.
    denoised = cv2.GaussianBlur(gray, (3, 3), 0)
    residual = cv2.absdiff(gray, denoised)
    noise_mean = float(np.mean(residual))
    noise_std = float(np.std(residual))

    # --- 2. Patch-based Noise Discrepancy (Local Inconsistency) ---
    # Divides residual into an 8x8 grid. If parts of the image are edited (Inpainted),
    # the noise distribution between blocks becomes heavily unbalanced.
    grid_size = 8
    bh, bw = h // grid_size, w // grid_size
    patch_means = []

    for i in range(grid_size):
        for j in range(grid_size):
            patch = residual[i * bh:(i + 1) * bh, j * bw:(j + 1) * bw]
            patch_means.append(np.mean(patch))

    patch_means = np.array(patch_means)
    mean_val = np.mean(patch_means)
    noise_discrepancy = float(np.std(patch_means) / (mean_val + 1e-6))

    # --- 3. 2D Fast Fourier Transform (FFT) Spectral Analysis ---
    # Checks energy ratio between high-frequency and mid-frequency bands.
    # Inpainting boundaries & GAN upsampling produce unnatural high-frequency spikes.
    resized = cv2.resize(gray, (256, 256))
    f = np.fft.fft2(resized)
    fshift = np.fft.fftshift(f)
    magnitude_spectrum = np.abs(fshift)

    y, x = np.ogrid[:256, :256]
    dist = np.sqrt((x - 128) ** 2 + (y - 128) ** 2)

    mid_freq = magnitude_spectrum[(dist >= 20) & (dist < 60)]
    high_freq = magnitude_spectrum[(dist >= 60) & (dist < 120)]
    freq_ratio = float(np.mean(high_freq) / (np.mean(mid_freq) + 1e-6))

    return {
        "image_bgr": img_bgr,
        "residual_map": residual,
        "fft_spectrum": 20 * np.log(magnitude_spectrum + 1),
        "noise_mean": noise_mean,
        "noise_std": noise_std,
        "noise_discrepancy": noise_discrepancy,
        "freq_ratio": freq_ratio
    }

def classify_image(features: dict) -> dict:
    """
    Multi-criteria classification engine to determine authenticity:
    - AUTHENTIC (REAL)
    - AI_GENERATED (FULLY SYNTHETIC)
    - AI_EDITED (LOCAL INPAINTING / MODIFICATION)
    """
    nm = features["noise_mean"]
    fr = features["freq_ratio"]
    nd = features["noise_discrepancy"]

    # Criterion 1: Fully AI Generated
    # Characterized by severe deficiency in hardware sensor noise residual
    if nm < 1.8:
        conf = min(98.5, 82.0 + (1.8 - nm) * 10.0)
        return {
            "verdict": "AI_GENERATED",
            "confidence": round(conf, 1),
            "primary_evidence": "Absence of physical camera sensor noise (overly smooth pixel residual)",
            "details": f"Noise Mean: {nm:.3f} (< 1.80 threshold)"
        }

    # Criterion 2: Locally AI Edited / Inpainted
    # Characterized by high-frequency stitching artifacts OR uneven local noise distribution
    is_freq_spike = fr >= 0.43
    is_noise_inconsistent = (nd > 0.65) and (nm < 4.8)

    if is_freq_spike or is_noise_inconsistent:
        conf = 72.0
        reasons = []
        if is_freq_spike:
            conf += 15.0
            reasons.append(f"High-frequency boundary discontinuity (Ratio: {fr:.3f} >= 0.430)")
        if is_noise_inconsistent:
            conf += 10.0
            reasons.append(f"Spatial noise discrepancy across patches (CV: {nd:.3f})")

        return {
            "verdict": "AI_EDITED",
            "confidence": min(95.0, round(conf, 1)),
            "primary_evidence": "Local anomaly detected between synthetic patches and baseline background",
            "details": "; ".join(reasons)
        }

    # Criterion 3: Authentic Camera Image
    return {
        "verdict": "AUTHENTIC (REAL)",
        "confidence": 88.0,
        "primary_evidence": "Consistent physical sensor noise profile and natural spectral decay",
        "details": f"Noise Mean: {nm:.3f}, HF/MF Ratio: {fr:.3f}"
    }

def generate_evidence_chart(image_name: str, features: dict, classification: dict, save_path: str):
    """Generates a professional 3-panel forensic evidence figure for reports."""
    fig, axes = plt.subplots(1, 3, figsize=(14, 4.5))

    # Panel 1: Original Image
    img_rgb = cv2.cvtColor(features["image_bgr"], cv2.COLOR_BGR2RGB)
    axes[0].imshow(img_rgb)
    axes[0].set_title(f"Input: {image_name}", fontsize=11, fontweight="bold")
    axes[0].axis("off")

    # Panel 2: Sensor Noise Residual
    axes[1].imshow(features["residual_map"], cmap="gray")
    axes[1].set_title(f"Noise Residual (Mean: {features['noise_mean']:.2f})", fontsize=11, fontweight="bold")
    axes[1].axis("off")

    # Panel 3: 2D-FFT Power Spectrum
    fft_norm = cv2.normalize(features["fft_spectrum"], None, 0, 255, cv2.NORM_MINMAX).astype(np.uint8)
    axes[2].imshow(fft_norm, cmap="magma")
    axes[2].set_title(f"FFT Spectrum (HF/MF: {features['freq_ratio']:.3f})", fontsize=11, fontweight="bold")
    axes[2].axis("off")

    # Header with classification result
    verdict = classification["verdict"]
    conf = classification["confidence"]
    fig.suptitle(f"Forensic Assessment: {verdict} ({conf}% Confidence)", fontsize=13, fontweight="bold", y=0.98)

    plt.tight_layout()
    plt.savefig(save_path, dpi=200)
    plt.close()

def run_forensic_pipeline(test_files: list):
    output_dir = "forensic_reports"
    os.makedirs(output_dir, exist_ok=True)

    print("=" * 70)
    print("       AI IMAGE FORENSIC & INTEGRITY INSPECTION PIPELINE")
    print("=" * 70)

    for file_path in test_files:
        if not os.path.exists(file_path):
            print(f"[SKIPPED] File not found: {file_path}")
            continue

        filename = os.path.basename(file_path)
        try:
            features = extract_forensic_features(file_path)
            res = classify_image(features)

            report_img_path = os.path.join(output_dir, f"report_{os.path.splitext(filename)[0]}.png")
            generate_evidence_chart(filename, features, res, report_img_path)

            print(f"\n[Target]: {filename}")
            print(f" -> Verdict:           {res['verdict']}")
            print(f" -> Confidence:        {res['confidence']}%")
            print(f" -> Key Findings:      {res['primary_evidence']}")
            print(f" -> Quantitative Data: {res['details']}")
            print(f" -> Evidence Saved:    {report_img_path}")
            print("-" * 70)

        except Exception as e:
            print(f"[ERROR] Failed to process {filename}: {str(e)}")

if __name__ == "__main__":
    # Test images list
    sample_images = [
        os.path.join("testImage", "real.png"),
        os.path.join("testImage", "ai.png"),
        os.path.join("testImage", "aiEdit.png")
    ]
    run_forensic_pipeline(sample_images)