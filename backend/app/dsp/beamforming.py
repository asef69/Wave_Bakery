"""
Acoustic Phased Array Beamforming DSP Module.

Calculates linear array steering, Array Factor (AF) radiation patterns,
phase-difference steering angles, and destination alignment for the
WaveKitchen acoustic beam delivery station.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Sequence
import numpy as np


@dataclass
class SpeakerState:
    id: int
    phase: float        # in degrees [-180, 180]
    amplitude: float = 1.0
    is_active: bool = True


def calculate_beam_angle(speakers: Sequence[dict | SpeakerState]) -> float:
    """
    Compute steered acoustic beam angle (-90 to +90 degrees) from speaker phase configurations.
    """
    active = []
    for s in speakers:
        if isinstance(s, dict):
            if s.get('is_active', s.get('isActive', True)):
                active.append(float(s.get('phase', 0.0)))
        else:
            if s.is_active:
                active.append(float(s.phase))

    if len(active) < 2:
        return 0.0

    total_delta = 0.0
    count = 0
    for i in range(len(active) - 1):
        diff = active[i + 1] - active[i]
        while diff > 180.0:
            diff -= 360.0
        while diff < -180.0:
            diff += 360.0
        total_delta += diff
        count += 1

    if count == 0:
        return 0.0
    avg_delta = total_delta / count

    # Linear mapping: -90 deg phase diff -> -60 deg beam angle, +90 deg -> +60 deg
    mock_steering_angle = max(-80.0, min(80.0, round((avg_delta / 90.0) * 60.0)))
    return float(mock_steering_angle)


def array_factor(angles_deg: np.ndarray, phases_deg: np.ndarray,
                 d_over_lambda: float = 0.5) -> np.ndarray:
    """
    Rigorous Array Factor calculation for a linear array of M elements:
    AF(theta) = |(1/M)* sum_{m=0}^{M-1} exp(j * (m * 2*pi * (d_over_lambda) * sin(theta) + phi_m))|
    """
    theta_rad = np.radians(angles_deg)
    phi_rad = np.radians(phases_deg)
    m_indices = np.arange(len(phases_deg))

    # Phase per element: psi_m(theta) = m * 2*pi * (d_over_lambda) * sin(theta) + phi_m
    psi = (m_indices[:, None] * 2.0 * np.pi * d_over_lambda * np.sin(theta_rad)[None, :]
           + phi_rad[:, None])
    af = np.abs(np.mean(np.exp(1j * psi), axis=0))
    return af.astype(np.float32)


def generate_beam_pattern(main_beam_angle: float, num_points: int = 73) -> list[dict]:
    """
    Generates beam intensity radiation pattern points across [-90, +90] degrees
    with main lobe and realistic sidelobes, matching frontend design.
    """
    start_angle = -90.0
    end_angle = 90.0
    step = (end_angle - start_angle) / (num_points - 1)
    points = []

    for i in range(num_points):
        angle = start_angle + i * step
        diff = abs(angle - main_beam_angle)

        main_lobe_width = 22.0
        intensity = np.exp(-((diff / (main_lobe_width * 0.6)) ** 2))

        side_diff1 = abs(diff - 35.0)
        side_diff2 = abs(diff - 65.0)
        sidelobe1 = 0.28 * np.exp(-((side_diff1 / 12.0) ** 2))
        sidelobe2 = 0.14 * np.exp(-((side_diff2 / 14.0) ** 2))

        intensity = max(intensity, sidelobe1, sidelobe2, 0.04)
        intensity = min(1.0, float(intensity))

        points.append({
            'angle': round(float(angle), 1),
            'intensity': round(float(intensity), 3)
        })

    return points


def check_beam_alignment(current_angle: float, target_angle: float,
                         tolerance_degrees: float = 6.0) -> bool:
    """
    Checks if steered beam angle is aligned with target angle within tolerance.
    """
    return abs(current_angle - target_angle) <= tolerance_degrees


def get_preset_phases_for_angle(target_angle: float, num_speakers: int = 8) -> list[int]:
    """
    Generates progressive linear phase shift for speakers to steer beam to target angle.
    """
    delta_phi = (target_angle / 60.0) * 90.0
    phases = []
    center_index = (num_speakers - 1) / 2.0

    for i in range(num_speakers):
        offset = i - center_index
        phase = round(offset * delta_phi)
        while phase > 180:
            phase -= 360
        while phase < -180:
            phase += 360
        phases.append(int(phase))
    return phases


def get_physical_steering_phases(target_angle_deg: float, num_speakers: int = 8,
                                 d_over_lambda: float = 0.5) -> list[float]:
    """
    Computes analytical progressive phase delay phi_m = -m * 2*pi * (d/lambda) * sin(theta_target)
    for an array of M elements to form a coherent mainlobe at target_angle_deg.
    """
    theta_rad = np.radians(target_angle_deg)
    delta_phi_deg = -np.degrees(2.0 * np.pi * d_over_lambda * np.sin(theta_rad))
    return [float(m * delta_phi_deg) for m in range(num_speakers)]
