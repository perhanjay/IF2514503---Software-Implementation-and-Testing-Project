import math

PENALTY_WEIGHTS = {
    "polarity_invert": 25.0,
    "fake_stereo": 20.0,
    "clipping": 15.0,
    "comb_filtering": 12.0,
    "sub_rumble": 10.0,
    "dc_offset": 8.0,
    "squashed_crest": 5.0
}

def generate_track_recommendations(metrics, pair_info=None):
    """
    Generates actionable technical recommendations in Bahasa Indonesia (FR-4.3).
    """
    recs = []
    track_name = metrics.get("fileName", "Trek")

    # 1. Polarity Inversion
    if pair_info and pair_info.get("has_polarity_invert"):
        other_name = pair_info.get("pairedTrackName", "trek pasangannya")
        recs.append({
            "type": "POLARITY_INVERT",
            "severity": "CRITICAL",
            "message": f"Polaritas 180° terbalik terhadap {other_name}. Terapkan Invert Polarity (Phase Flip Ø) untuk memulihkan low-end punch dan ketebalan instrumen."
        })

    # 2. Fake Stereo / Haas Effect
    if metrics.get("has_fake_stereo"):
        delay_ms = metrics.get("haas_delay_ms", 0.0)
        recs.append({
            "type": "FAKE_STEREO",
            "severity": "CRITICAL",
            "message": f"Terdeteksi delay artifisial Haas ({delay_ms} ms) yang rentan fase saling meniadakan saat diputar mono. Rekomendasi: Gunakan stereo spreader mid/side mono-safe atau jadikan mono sejati."
        })

    # 3. Digital Clipping / Inter-sample Peaks
    if metrics.get("is_clipping"):
        tp = metrics.get("true_peak_dbfs", 0.0)
        needed_cut = round(max(0.5, tp + 0.5), 1)
        recs.append({
            "type": "CLIPPING",
            "severity": "CRITICAL",
            "message": f"True-Peak mencapai {tp} dBFS (melebihi batas aman -0.5 dBFS). Turunkan clip gain atau fader minimal {needed_cut} dBFS untuk mencegah distorsi inter-sample."
        })

    # 4. Comb Filtering from Micro-delays
    if pair_info and pair_info.get("has_comb_filtering"):
        other_name = pair_info.get("pairedTrackName", "trek pasangannya")
        delay_ms = pair_info.get("delay_ms", 0.0)
        delay_samples = pair_info.get("delay_samples", 0)
        recs.append({
            "type": "COMB_FILTERING",
            "severity": "WARNING",
            "message": f"Terdeteksi selisih waktu {delay_ms} ms ({delay_samples} sampel) terhadap {other_name} yang memicu comb filtering. Terapkan time-alignment mikro."
        })

    # 5. Subsonic Rumble
    if metrics.get("has_sub_rumble"):
        sub_ratio = metrics.get("sub_energy_ratio", 0.0) * 100.0
        recs.append({
            "type": "SUB_RUMBLE",
            "severity": "WARNING",
            "message": f"Energi subsonik di bawah 35 Hz memakan {sub_ratio:.1f}% total energi trek. Pasang High-Pass Filter (HPF) di rentang 35–80 Hz untuk membersihkan headroom."
        })

    # 6. DC Offset
    if metrics.get("has_dc_offset"):
        dc_pct = metrics.get("dc_offset_pct", 0.0)
        recs.append({
            "type": "DC_OFFSET",
            "severity": "WARNING",
            "message": f"Titik nol gelombang tergeser (DC Offset {dc_pct:.2f}%). Aktifkan filter DC offset removal (HPF 10 Hz) agar dynamic processor bekerja simetris."
        })

    # 7. Squashed Dynamics / Low Crest Factor
    crest = metrics.get("crest_factor_db", 12.0)
    if crest < 6.0 and metrics.get("peak_dbfs", -100) > -30:
        recs.append({
            "type": "LOW_DYNAMICS",
            "severity": "INFO",
            "message": f"Crest factor sangat rendah ({crest:.1f} dB). Sinyal terlalu mampat / terkompresi keras, pertimbangkan untuk melonggarkan limiter atau kompresor."
        })

    return recs

def calculate_track_health(metrics, pair_info=None):
    """
    Computes individual track health status and issue flags.
    Status: 'Clean' | 'Warning' | 'Critical'
    """
    has_polarity = bool(pair_info and pair_info.get("has_polarity_invert"))
    has_comb = bool(pair_info and pair_info.get("has_comb_filtering"))
    has_fake_stereo = bool(metrics.get("has_fake_stereo"))
    has_clipping = bool(metrics.get("is_clipping"))
    has_sub_rumble = bool(metrics.get("has_sub_rumble"))
    has_dc_offset = bool(metrics.get("has_dc_offset"))

    recs = generate_track_recommendations(metrics, pair_info)

    # Determine status
    if has_polarity or has_fake_stereo or has_clipping:
        status = "Critical"
    elif has_comb or has_sub_rumble or has_dc_offset or metrics.get("crest_factor_db", 12.0) < 6.0:
        status = "Warning"
    else:
        status = "Clean"

    # Compute individual track penalty
    penalty = 0.0
    if has_polarity:
        penalty += PENALTY_WEIGHTS["polarity_invert"]
    if has_fake_stereo:
        penalty += PENALTY_WEIGHTS["fake_stereo"]
    if has_clipping:
        penalty += PENALTY_WEIGHTS["clipping"]
    if has_comb:
        penalty += PENALTY_WEIGHTS["comb_filtering"]
    if has_sub_rumble:
        penalty += PENALTY_WEIGHTS["sub_rumble"]
    if has_dc_offset:
        penalty += PENALTY_WEIGHTS["dc_offset"]

    track_score = max(0.0, min(100.0, 100.0 - penalty))

    return {
        "health_status": status,
        "track_score": round(track_score, 1),
        "penalty": penalty,
        "has_polarity_invert": has_polarity,
        "has_comb_filtering": has_comb,
        "has_fake_stereo": has_fake_stereo,
        "has_clipping": has_clipping,
        "has_sub_rumble": has_sub_rumble,
        "has_dc_offset": has_dc_offset,
        "recommendations": recs
    }

def calculate_session_health(tracks_diagnostics, pairs_diagnostics):
    """
    Calculates overall Mix Health Score (0 - 100) (FR-4.1, FR-4.2).
    Score calculation starts at 100.0, penalized proportionally by anomalies found.
    """
    num_tracks = max(1, len(tracks_diagnostics))

    total_track_penalties = sum(t.get("penalty", 0.0) for t in tracks_diagnostics)

    # Average penalty across tracks with a ceiling impact
    avg_track_penalty = total_track_penalties / num_tracks

    # Additional direct penalty for severe global session faults
    severe_issues_count = sum(1 for t in tracks_diagnostics if t.get("health_status") == "Critical")
    warning_issues_count = sum(1 for t in tracks_diagnostics if t.get("health_status") == "Warning")

    # Formula: 100 - (avg_track_penalty * 0.7 + severe_count * 8 + warning_count * 3)
    raw_deduction = (avg_track_penalty * 0.7) + (severe_issues_count * 8.0) + (warning_issues_count * 3.0)
    final_score = max(5.0, min(100.0, 100.0 - raw_deduction))

    if final_score >= 90.0:
        session_rating = "EXCELLENT"
        rating_label = "Optimal & Siap Mix"
    elif final_score >= 65.0:
        session_rating = "WARNING"
        rating_label = "Perlu Penyesuaian"
    else:
        session_rating = "CRITICAL"
        rating_label = "Kritis & Butuh Perbaikan Fasa"

    # Token estimation: standard 1 token; if > 3 problematic tracks, 2 tokens
    problematic_tracks = severe_issues_count + warning_issues_count
    estimated_tokens = 1 if problematic_tracks <= 3 else 2

    return {
        "health_score": round(final_score, 1),
        "session_rating": session_rating,
        "rating_label": rating_label,
        "total_tracks": num_tracks,
        "clean_tracks": sum(1 for t in tracks_diagnostics if t.get("health_status") == "Clean"),
        "warning_tracks": warning_issues_count,
        "critical_tracks": severe_issues_count,
        "estimated_tokens": estimated_tokens
    }

if __name__ == "__main__":
    print("Testing Health Score Engine...")

    # Case 1: Clean Session (all clean)
    clean_t1 = calculate_track_health({"fileName": "Vocal.wav", "true_peak_dbfs": -6.0, "is_clipping": False})
    clean_t2 = calculate_track_health({"fileName": "Acoustic.wav", "true_peak_dbfs": -8.0, "is_clipping": False})
    session_clean = calculate_session_health([clean_t1, clean_t2], [])
    print("Clean Session Result:", session_clean)
    assert session_clean["health_score"] >= 95.0
    assert session_clean["session_rating"] == "EXCELLENT"

    # Case 2: Inverted Snare Pair + Clipped Bass
    inverted_pair = {"has_polarity_invert": True, "pairedTrackName": "Snare Top"}
    bad_t1 = calculate_track_health({"fileName": "Snare Bottom.wav", "true_peak_dbfs": -2.0}, inverted_pair)
    bad_t2 = calculate_track_health({"fileName": "Bass.wav", "true_peak_dbfs": 1.2, "is_clipping": True})
    session_bad = calculate_session_health([bad_t1, bad_t2], [inverted_pair])
    print("Problematic Session Result:", session_bad)
    assert bad_t1["health_status"] == "Critical"
    assert bad_t2["health_status"] == "Critical"
    assert session_bad["health_score"] < 75.0
    assert len(bad_t1["recommendations"]) > 0

    print("✓ Health Score Engine PASSED All Tests!")
