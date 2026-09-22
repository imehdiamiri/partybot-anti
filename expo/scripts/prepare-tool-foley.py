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

def write(name, data, loop=False):
    if loop:
        # Overlap the endpoints so repeating the friction doesn't click or pause.
        n = round(RATE * .05)
        fade = np.linspace(0, 1, n)
        cross = data[-n:] * (1 - fade) + data[:n] * fade
        data = np.concatenate([cross, data[n:-n]])
    else:
        n = min(round(RATE * .008), len(data) // 4)
        data[:n] *= np.linspace(0, 1, n)
        data[-n:] *= np.linspace(1, 0, n)
    data *= .82 / max(np.max(np.abs(data)), .0001)
    sf.write(OUTPUT / (name + '.wav'), data, RATE, subtype='PCM_16')
    print(name, round(len(data) / RATE, 3), 'seconds')

write('bottle-tick', clip('bottle.mp3', 30.5, 31.25), loop=True)
write('bottle-end', clip('bottle.mp3', 31.1, 32.1))
wheel = clip('wheel.mp3', 0, 1.5)
peak = int(np.argmax(np.abs(wheel)))
start = max(0, peak - round(.004 * RATE))
write('wheel-tick', wheel[start:start + round(.055 * RATE)].copy())
write('wheel-end', clip('wheel.mp3', 2.35, 2.55))
write('dice-tick', clip('casino/Audio/dice-shake-1.ogg', .42, .55))
write('dice-end', clip('casino/Audio/dice-throw-1.ogg', 0, .45))
write('coin-tick', clip('coin.mp3', 1.17, 1.31))
write('coin-end', clip('coin.mp3', 8.87, 9.26))
write('teams-tick', clip('casino/Audio/card-shuffle.ogg', .25, .4))
write('teams-end', clip('casino/Audio/card-place-1.ogg', 0, .4))
write('hourglass-tick', clip('timer.mp3', 4, 4.14))
write('hourglass-end', clip('timer.mp3', 10.51, 11.85))
