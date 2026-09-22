"""Prepare recorded CC0 Foley. Requires numpy + soundfile; inputs in .expo/foley.
See assets/sounds/tools/SOURCES.md for URLs, licenses and source hashes.
Run from expo: python scripts/prepare-tool-foley.py
"""
from pathlib import Path
import numpy as np
import soundfile as sf

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / '.expo/foley'
OUTPUT = ROOT / 'assets/sounds/tools'
RATE = 44100

def clip(file, start, end):
    data, rate = sf.read(SOURCE / file)
    if data.ndim > 1:
        data = data.mean(axis=1)
    data = data[round(start * rate):round(end * rate)]
    data = data - data.mean()
    if rate != RATE:
        data = np.interp(np.arange(round(len(data) * RATE / rate)) * rate / RATE, np.arange(len(data)), data)
    return data

def write(name, data, tail=.06, cutoff=4500):
    # Remove low handling rumble and soften harsh high-frequency contact noise.
    size = 1 << (len(data) * 2 - 1).bit_length()
    freq = np.fft.rfftfreq(size, 1 / RATE)
    response = (1 - np.exp(-(freq / 95) ** 4)) / np.sqrt(1 + (freq / cutoff) ** 8)
    data = np.fft.irfft(np.fft.rfft(data, size) * response, size)[:len(data)]
    # A smooth noise floor gate suppresses room hiss between physical contacts.
    window = max(1, round(RATE * .012))
    energy = np.convolve(data * data, np.ones(window) / window, mode='same')
    data *= np.clip((np.sqrt(energy) - .00025) / .0009, 0, 1)
    attack = min(round(RATE * .006), len(data) // 4)
    release = min(round(RATE * tail), len(data) // 3)
    data[:attack] *= np.linspace(0, 1, attack)
    data[-release:] *= np.linspace(1, 0, release)
    # Do not aggressively normalize noise or hard peaks as the old pack did.
    peak = max(np.max(np.abs(data)), .0001)
    rms = max(np.sqrt(np.mean(data * data)), .0001)
    data *= min(4, .48 / peak, .065 / rms)
    sf.write(OUTPUT / (name + '.wav'), data, RATE, subtype='PCM_16')
    print(name, round(len(data) / RATE, 3), 'seconds; peak', round(float(max(abs(data))), 3))

# Complete motions, never short looping grains. New recordings/cuts for every cue.
write('bottle-tick', clip('bottle-spin-new.mp3', 7.55, 8.85), tail=.18, cutoff=3300)
write('bottle-end', clip('bottle-spin-new.mp3', 8.95, 9.22), cutoff=3300)
write('wheel-tick', clip('impact/Audio/impactWood_light_000.ogg', 0, .18), cutoff=3000)
write('wheel-end', clip('impact/Audio/impactWood_light_002.ogg', 0, .24), cutoff=2400)
write('dice-tick', clip('casino/Audio/dice-shake-3.ogg', .03, 1.38), tail=.12)
write('dice-end', clip('casino/Audio/dice-throw-3.ogg', .015, .5), tail=.12)
write('coin-tick', clip('coin-new.mp3', .55, 3.1), tail=.2, cutoff=5500)
write('coin-end', clip('coin-new.mp3', 9.02, 9.3), cutoff=5000)
write('teams-tick', clip('casino/Audio/card-fan-2.ogg', .7, 1.2), tail=.1)
write('teams-end', clip('casino/Audio/card-place-4.ogg', .22, .56), tail=.08)
write('hourglass-tick', clip('timer-new.mp3', 1.825, 1.975), cutoff=3500)
write('hourglass-end', clip('timer-new.mp3', 2.02, 3.62), tail=.35, cutoff=4000)
