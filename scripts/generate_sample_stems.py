#!/usr/bin/env python3
"""
Polaris Audio - Sample Stems & Multitrack Generator
Menghasilkan berkas audio sintetis WAV dan arsip ZIP yang dirancang khusus
untuk menguji Modul 5 (Ingestion), Modul 6 (AI Classification & Pairing),
dan Modul 7 (DSP Diagnostic Engine & Mix Health Score).
"""

import os
import zipfile
import numpy as np
import soundfile as sf

def generate_samples(output_dir="sample-stems"):
    os.makedirs(output_dir, exist_ok=True)
    sr = 48000
    duration = 3.0  # 3 detik standar
    t = np.linspace(0, duration, int(sr * duration), endpoint=False)

    print(f"[*] Menghasilkan berkas stem audio di direktori: {output_dir}/")

    # 1. Kick In (Sub 50Hz punch)
    kick_pulse = np.zeros_like(t)
    for p in np.arange(0, duration, 0.75):
        idx = int(p * sr)
        remain = len(t) - idx
        seg = min(remain, int(sr * 0.4))
        kick_pulse[idx:idx+seg] += np.sin(2 * np.pi * 55 * t[:seg]) * np.exp(-t[:seg] * 12) * 0.8
    kick_in_path = os.path.join(output_dir, "01_Kick_In.wav")
    sf.write(kick_in_path, kick_pulse.astype(np.float32), sr)
    print("  [✓] 01_Kick_In.wav")

    # 2. Kick Sub / Out (Sub 40Hz)
    kick_sub_pulse = np.zeros_like(t)
    for p in np.arange(0, duration, 0.75):
        idx = int(p * sr)
        remain = len(t) - idx
        seg = min(remain, int(sr * 0.5))
        kick_sub_pulse[idx:idx+seg] += np.sin(2 * np.pi * 42 * t[:seg]) * np.exp(-t[:seg] * 9) * 0.75
    kick_sub_path = os.path.join(output_dir, "02_Kick_Sub.wav")
    sf.write(kick_sub_path, kick_sub_pulse.astype(np.float32), sr)
    print("  [✓] 02_Kick_Sub.wav (Pasangan Kick In -> MIC_PAIR)")

    # 3. Snare Top (220Hz tone + crack noise)
    snare_top = np.zeros_like(t)
    for p in np.arange(0.375, duration, 0.75):
        idx = int(p * sr)
        remain = len(t) - idx
        seg = min(remain, int(sr * 0.35))
        hit = (np.sin(2 * np.pi * 210 * t[:seg]) + np.random.normal(0, 0.4, seg)) * np.exp(-t[:seg] * 14) * 0.7
        snare_top[idx:idx+seg] += hit
    snare_top_path = os.path.join(output_dir, "03_Snare_Top.wav")
    sf.write(snare_top_path, snare_top.astype(np.float32), sr)
    print("  [✓] 03_Snare_Top.wav")

    # 4. Snare Bottom - Polarity Inverted 180 deg (Out-of-phase untuk menguji deteksi anomali DSP TC-DSP-04)
    snare_btm = -1.0 * snare_top * 0.85
    snare_btm_path = os.path.join(output_dir, "04_Snare_Btm.wav")
    sf.write(snare_btm_path, snare_btm.astype(np.float32), sr)
    print("  [✓] 04_Snare_Btm.wav (Inverted 180° -> DRUM_TOP_BOTTOM)")

    # 5. Bass DI (Clean sub/low 82Hz tone)
    bass_di = (np.sin(2 * np.pi * 82.4 * t) + 0.4 * np.sin(2 * np.pi * 164.8 * t)) * 0.6
    bass_di_path = os.path.join(output_dir, "05_Bass_DI.wav")
    sf.write(bass_di_path, bass_di.astype(np.float32), sr)
    print("  [✓] 05_Bass_DI.wav")

    # 6. Bass Amp Mic (Mic paired with DI)
    bass_amp = (bass_di * 0.8) + (np.sin(2 * np.pi * 247.2 * t) * 0.2)
    bass_amp_path = os.path.join(output_dir, "06_Bass_Amp.wav")
    sf.write(bass_amp_path, bass_amp.astype(np.float32), sr)
    print("  [✓] 06_Bass_Amp.wav (Pasangan Bass DI -> BASS_DI_MIC)")

    # 7. Vocal Lead with Sub-Rumble (20Hz rumble untuk menguji filter sub-rumble TC-DSP-04)
    vocal = np.sin(2 * np.pi * 440 * t) * 0.4 + np.sin(2 * np.pi * 880 * t) * 0.2
    vocal_with_rumble = vocal + 0.35 * np.sin(2 * np.pi * 18 * t)  # Sub 18Hz rumble
    vox_path = os.path.join(output_dir, "07_Vocal_Lead.wav")
    sf.write(vox_path, vocal_with_rumble.astype(np.float32), sr)
    print("  [✓] 07_Vocal_Lead.wav (Mengandung Sub-Rumble <35Hz)")

    # 8. Stereo Guitar with Haas Fake Stereo (12ms delay L & R)
    gtr_mono = np.sin(2 * np.pi * 330 * t) * 0.4 + np.sin(2 * np.pi * 660 * t) * 0.2
    haas_delay_samples = int(sr * 0.012)  # 12 ms
    gtr_r = np.zeros_like(gtr_mono)
    gtr_r[haas_delay_samples:] = gtr_mono[:-haas_delay_samples]
    gtr_stereo = np.column_stack([gtr_mono, gtr_r])
    gtr_path = os.path.join(output_dir, "08_Guitar_Elec.wav")
    sf.write(gtr_path, gtr_stereo.astype(np.float32), sr)
    print("  [✓] 08_Guitar_Elec.wav (Stereo dengan Haas Effect 12ms)")

    # 9. Track Desync (Durasi 4.5s vs 3.0s untuk menguji TC-INGEST-04 Warning)
    t_long = np.linspace(0, 4.5, int(sr * 4.5), endpoint=False)
    desync_audio = np.sin(2 * np.pi * 440 * t_long) * 0.3
    desync_path = os.path.join(output_dir, "09_Desync_Synth.wav")
    sf.write(desync_path, desync_audio.astype(np.float32), sr)
    print("  [✓] 09_Desync_Synth.wav (Durasi 4.5 detik -> Untuk uji TC-INGEST-04 Duration Drift)")

    # 10. Buat arsip ZIP multitrack zero-aligned (TC-INGEST-02 & TC-INGEST-03 PASSED)
    zip_passed_path = os.path.join(output_dir, "polaris_multitrack_session_passed.zip")
    with zipfile.ZipFile(zip_passed_path, 'w', zipfile.ZIP_DEFLATED) as zipf:
        for fname in ["01_Kick_In.wav", "02_Kick_Sub.wav", "03_Snare_Top.wav", "04_Snare_Btm.wav", "05_Bass_DI.wav", "06_Bass_Amp.wav", "07_Vocal_Lead.wav", "08_Guitar_Elec.wav"]:
            zipf.write(os.path.join(output_dir, fname), arcname=fname)
    print(f"  [✓] {zip_passed_path} (Arsip ZIP Zero-Aligned Siap Uji)")

    # 11. Buat arsip ZIP desync (TC-INGEST-04 WARNING)
    zip_warning_path = os.path.join(output_dir, "polaris_multitrack_session_drift_warning.zip")
    with zipfile.ZipFile(zip_warning_path, 'w', zipfile.ZIP_DEFLATED) as zipf:
        for fname in ["01_Kick_In.wav", "03_Snare_Top.wav", "09_Desync_Synth.wav"]:
            zipf.write(os.path.join(output_dir, fname), arcname=fname)
    print(f"  [✓] {zip_warning_path} (Arsip ZIP Desync untuk Uji Drift)")

    print(f"\n[+] Sukses! Seluruh berkas sampel tersimpan rapi di: {os.path.abspath(output_dir)}")

if __name__ == "__main__":
    generate_samples()
