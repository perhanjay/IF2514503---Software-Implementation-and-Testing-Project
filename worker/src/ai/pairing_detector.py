import re

def detect_track_pairs(tracks):
    """
    Detects physical multi-mic and stereo split track pairs from a session's tracks.
    Supported Pair Types:
    - DRUM_TOP_BOTTOM (e.g. Snare Top / Snare Bottom)
    - MIC_PAIR (e.g. Kick In / Kick Out or Kick Sub)
    - BASS_DI_MIC (e.g. Bass DI / Bass Amp Mic)
    - STEREO_SPLIT (e.g. Overhead L / Overhead R, Acoustic L / R)
    """
    pairs = []
    paired_ids = set()

    n = len(tracks)
    for i in range(n):
        for j in range(i + 1, n):
            track_a = tracks[i]
            track_b = tracks[j]
            id_a = track_a.get("id") or track_a.get("trackId")
            id_b = track_b.get("id") or track_b.get("trackId")

            if id_a in paired_ids or id_b in paired_ids:
                continue

            name_a = track_a.get("fileName", "")
            name_b = track_b.get("fileName", "")
            clean_a = re.sub(r'[^a-zA-Z0-9]+', ' ', name_a).lower()
            clean_b = re.sub(r'[^a-zA-Z0-9]+', ' ', name_b).lower()

            label_a = track_a.get("detectedLabel", "").lower()
            label_b = track_b.get("detectedLabel", "").lower()

            # 1. DRUM_TOP_BOTTOM (Snare Top & Bottom)
            is_snare_a = "snare" in label_a or bool(re.search(r'\bsnare\b|\bsnr\b|\bsd\b', clean_a))
            is_snare_b = "snare" in label_b or bool(re.search(r'\bsnare\b|\bsnr\b|\bsd\b', clean_b))
            if is_snare_a and is_snare_b:
                has_top_a = bool(re.search(r'\btop\b|\bup\b', clean_a))
                has_btm_b = bool(re.search(r'\bbtm\b|\bbottom\b|\bdn\b|\bdown\b', clean_b))
                has_top_b = bool(re.search(r'\btop\b|\bup\b', clean_b))
                has_btm_a = bool(re.search(r'\bbtm\b|\bbottom\b|\bdn\b|\bdown\b', clean_a))

                if (has_top_a and has_btm_b) or (has_top_b and has_btm_a) or (not has_top_a and not has_top_b):
                    pairs.append({
                        "trackAId": id_a if (has_top_a or not has_top_b) else id_b,
                        "trackBId": id_b if (has_top_a or not has_top_b) else id_a,
                        "pairType": "DRUM_TOP_BOTTOM",
                        "confidence": 0.95,
                        "reason": "Snare Top dan Snare Bottom mikrofon terdeteksi berpasangan"
                    })
                    paired_ids.add(id_a)
                    paired_ids.add(id_b)
                    continue

            # 2. MIC_PAIR (Kick In & Out / Sub)
            is_kick_a = "kick" in label_a or bool(re.search(r'\bkick\b|\bbd\b|\bkik\b', clean_a))
            is_kick_b = "kick" in label_b or bool(re.search(r'\bkick\b|\bbd\b|\bkik\b', clean_b))
            if is_kick_a and is_kick_b:
                has_in_a = bool(re.search(r'\bin\b|\binside\b', clean_a))
                has_out_b = bool(re.search(r'\bout\b|\boutside\b|\bsub\b', clean_b))
                has_in_b = bool(re.search(r'\bin\b|\binside\b', clean_b))
                has_out_a = bool(re.search(r'\bout\b|\boutside\b|\bsub\b', clean_a))

                if (has_in_a and has_out_b) or (has_in_b and has_out_a) or True: # If 2 kicks in session
                    pairs.append({
                        "trackAId": id_a if (has_in_a or not has_in_b) else id_b,
                        "trackBId": id_b if (has_in_a or not has_in_b) else id_a,
                        "pairType": "MIC_PAIR",
                        "confidence": 0.92,
                        "reason": "Kick In dan Kick Out/Sub terdeteksi berpasangan"
                    })
                    paired_ids.add(id_a)
                    paired_ids.add(id_b)
                    continue

            # 3. BASS_DI_MIC (Bass DI & Bass Amp Mic)
            is_bass_a = "bass" in label_a or bool(re.search(r'\bbass\b|\bbs\b', clean_a))
            is_bass_b = "bass" in label_b or bool(re.search(r'\bbass\b|\bbs\b', clean_b))
            if is_bass_a and is_bass_b:
                has_di_a = bool(re.search(r'\bdi\b', clean_a))
                has_mic_b = bool(re.search(r'\bmic\b|\bamp\b|\bcab\b', clean_b))
                has_di_b = bool(re.search(r'\bdi\b', clean_b))
                has_mic_a = bool(re.search(r'\bmic\b|\bamp\b|\bcab\b', clean_a))

                if (has_di_a and has_mic_b) or (has_di_b and has_mic_a) or True: # If 2 basses in session
                    pairs.append({
                        "trackAId": id_a if (has_di_a or not has_di_b) else id_b,
                        "trackBId": id_b if (has_di_a or not has_di_b) else id_a,
                        "pairType": "BASS_DI_MIC",
                        "confidence": 0.90,
                        "reason": "Bass Direct Injection (DI) dan Bass Amp Mic terdeteksi berpasangan"
                    })
                    paired_ids.add(id_a)
                    paired_ids.add(id_b)
                    continue

            # 4. STEREO_SPLIT (L / R Channel Pair)
            is_left_a = bool(re.search(r'\b(l|left)\b', clean_a))
            is_right_b = bool(re.search(r'\b(r|right)\b', clean_b))
            is_left_b = bool(re.search(r'\b(l|left)\b', clean_b))
            is_right_a = bool(re.search(r'\b(r|right)\b', clean_a))

            if (is_left_a and is_right_b) or (is_left_b and is_right_a):
                pairs.append({
                    "trackAId": id_a if is_left_a else id_b,
                    "trackBId": id_b if is_left_a else id_a,
                    "pairType": "STEREO_SPLIT",
                    "confidence": 0.96,
                    "reason": "Sepasang trek kanal Left (L) dan Right (R) stereo terpisah"
                })
                paired_ids.add(id_a)
                paired_ids.add(id_b)
                continue

    return pairs

if __name__ == "__main__":
    print("Testing Pairing Detector...")
    mock_tracks = [
        {"id": "t1", "fileName": "01_Kick_In.wav", "detectedLabel": "Drums: Kick"},
        {"id": "t2", "fileName": "02_Kick_Sub.wav", "detectedLabel": "Drums: Kick"},
        {"id": "t3", "fileName": "03_Snare_Top.wav", "detectedLabel": "Drums: Snare"},
        {"id": "t4", "fileName": "04_Snare_Btm.wav", "detectedLabel": "Drums: Snare"},
        {"id": "t5", "fileName": "05_Bass_DI.wav", "detectedLabel": "Bass"},
        {"id": "t6", "fileName": "06_Bass_Amp.wav", "detectedLabel": "Bass"},
        {"id": "t7", "fileName": "07_Overhead_L.wav", "detectedLabel": "Drums: Overhead"},
        {"id": "t8", "fileName": "08_Overhead_R.wav", "detectedLabel": "Drums: Overhead"},
    ]

    detected = detect_track_pairs(mock_tracks)
    print(f"Detected {len(detected)} pairs:")
    for p in detected:
        print(f"  🔗 {p['trackAId']} <-> {p['trackBId']} [{p['pairType']}] ({p['confidence']*100:.0f}%): {p['reason']}")

    assert len(detected) == 4
    print("✓ Pairing Detector PASSED")
