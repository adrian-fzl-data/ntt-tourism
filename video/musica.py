"""Música del vídeo: una pista original de 45 s generada aquí mismo con numpy (sin muestras ni
licencias de terceros). Pads suaves, un arpegio y percusión ligera a 96 pulsos por minuto, con
la progresión Do – Sol – La menor – Fa.

Uso: python3 video/musica.py salida.wav [--duracion 45]
"""
import sys
import wave

import numpy as np

SR = 48000
BPM = 96
PULSO = 60 / BPM
COMPAS = 4 * PULSO
dur = float(sys.argv[sys.argv.index('--duracion') + 1]) if '--duracion' in sys.argv else 45.0
salida = sys.argv[1] if len(sys.argv) > 1 and not sys.argv[1].startswith('--') else 'musica.wav'
N = int(dur * SR)
t_total = np.arange(N) / SR
rng = np.random.default_rng(7)


def nota(n):
    """Frecuencia de una nota MIDI."""
    return 440.0 * 2 ** ((n - 69) / 12)


def paso_bajo(x, corte):
    """Filtro paso bajo de un polo (suficiente para suavizar)."""
    a = np.exp(-2 * np.pi * corte / SR)
    y = np.empty_like(x)
    acc = 0.0
    for i in range(len(x)):
        acc = (1 - a) * x[i] + a * acc
        y[i] = acc
    return y


def envolvente(n, ataque, caida, sostener=1.0):
    e = np.ones(n) * sostener
    na, nc = int(ataque * SR), int(caida * SR)
    if na:
        e[:na] = np.linspace(0, sostener, na)
    if nc:
        e[-nc:] = e[-nc:] * np.linspace(1, 0, nc)
    return e


mezcla = np.zeros(N)

# Progresión (MIDI): Do, Sol, La menor, Fa; un acorde por compás
ACORDES = [[48, 55, 60, 64, 67], [43, 55, 59, 62, 67], [45, 57, 60, 64, 69], [41, 53, 57, 60, 65]]

# 1) Pad: sierras desafinadas y filtradas, con entrada lenta
pad = np.zeros(N)
n_comp = int(np.ceil(dur / COMPAS))
for c in range(n_comp):
    ini = int(c * COMPAS * SR)
    fin = min(N, int((c + 1) * COMPAS * SR) + int(0.3 * SR))
    if ini >= N:
        break
    tt = np.arange(fin - ini) / SR
    seg = np.zeros(fin - ini)
    for m in ACORDES[c % 4][1:]:
        for desaf in (-0.12, 0.0, 0.12):
            f = nota(m) * 2 ** (desaf / 12)
            seg += 2 * ((tt * f) % 1.0) - 1
    seg *= envolvente(len(seg), 0.4, 0.5)
    pad[ini:fin] += seg
pad = paso_bajo(pad, 900) * 0.035
mezcla += pad

# 2) Bajo: notas largas con la fundamental
bajo = np.zeros(N)
for c in range(n_comp):
    ini = int(c * COMPAS * SR)
    if ini >= N:
        break
    fin = min(N, ini + int(COMPAS * SR))
    tt = np.arange(fin - ini) / SR
    f = nota(ACORDES[c % 4][0] - 12)
    bajo[ini:fin] += (np.sin(2 * np.pi * f * tt) + 0.3 * np.sin(4 * np.pi * f * tt)) * envolvente(fin - ini, 0.02, 0.3)
mezcla += bajo * 0.16 * np.clip((t_total - 2.5) / 2.5, 0, 1)  # entra a los 2,5 s

# 3) Arpegio: corcheas con timbre de pulsación (seno + armónicos con caída rápida)
arp = np.zeros(N)
corchea = PULSO / 2
patron = [0, 2, 1, 3, 2, 4, 3, 2]
k = 0
tpos = 5.0  # entra con el primer cambio de escena
while tpos < dur - 0.5:
    c = int(tpos // COMPAS)
    notas = ACORDES[c % 4][1:]
    m = notas[patron[k % 8] % len(notas)] + 12
    ini = int(tpos * SR)
    largo = int(0.45 * SR)
    fin = min(N, ini + largo)
    tt = np.arange(fin - ini) / SR
    f = nota(m)
    golpe = (np.sin(2 * np.pi * f * tt) + 0.35 * np.sin(4 * np.pi * f * tt) + 0.1 * np.sin(6 * np.pi * f * tt)) * np.exp(-tt * 9)
    arp[ini:fin] += golpe
    k += 1
    tpos += corchea
arp = paso_bajo(arp, 3500) * 0.07
mezcla += arp

# 4) Percusión ligera: bombo suave en cada pulso y platillo cerrado a contratiempo, desde los 5 s
perc = np.zeros(N)
tpos = 5.0
while tpos < dur - 2.5:
    ini = int(tpos * SR)
    largo = int(0.25 * SR)
    fin = min(N, ini + largo)
    tt = np.arange(fin - ini) / SR
    f = 50 + 70 * np.exp(-tt * 30)
    perc[ini:fin] += np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-tt * 14) * 0.5
    ini2 = int((tpos + PULSO / 2) * SR)
    fin2 = min(N, ini2 + int(0.06 * SR))
    if ini2 < N:
        ruido = rng.standard_normal(fin2 - ini2)
        ruido = ruido - paso_bajo(ruido, 6000)  # paso alto
        perc[ini2:fin2] += ruido * np.exp(-np.arange(fin2 - ini2) / SR * 60) * 0.08
    tpos += PULSO
mezcla += perc * 0.5

# 5) Golpe final suave en el cierre (a los dur − 4 s) y salida
ini = int((dur - 4.0) * SR)
tt = np.arange(N - ini) / SR
for m in ACORDES[0]:
    mezcla[ini:] += np.sin(2 * np.pi * nota(m + 12) * tt) * np.exp(-tt * 0.9) * 0.025

# Entrada y salida, y normalización a −1 dBFS
mezcla *= np.clip(t_total / 1.5, 0, 1) * np.clip((dur - t_total) / 2.5, 0, 1)
mezcla /= np.max(np.abs(mezcla)) / 10 ** (-1 / 20)
estereo = np.stack([mezcla, np.roll(mezcla, int(0.012 * SR)) * 0.96 + mezcla * 0.04], axis=1)
datos = (np.clip(estereo, -1, 1) * 32767).astype('<i2')
with wave.open(salida, 'wb') as w:
    w.setnchannels(2)
    w.setsampwidth(2)
    w.setframerate(SR)
    w.writeframes(datos.tobytes())
print(f'{salida}: {dur:.1f} s, {SR} Hz, estéreo')
