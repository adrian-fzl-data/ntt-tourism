# Vídeo de 45 s de la demo

Grabación real de la demo de agosto de 2024 con Playwright, fotograma a fotograma a 60 fps: el reloj de la página se detiene (`page.clock`) y avanza 1/60 s entre captura y captura, así que las animaciones de Leaflet y de la web salen fluidas aunque la máquina sea lenta. El cursor, los rótulos, las tarjetas y la cámara (zoom que sigue al cursor) se dibujan encima con los colores y la tipografía de la propia web.

```bash
python3 -m http.server 8731                      # desde la raíz del repositorio
node video/grabar.js --salida salida-video --nombre "Nombre Apellido" --direccion "usuario.github.io/ntt-tourism"
node video/montar.js --salida salida-video --direccion "usuario.github.io/ntt-tourism"
```

- `grabar.js` deja `fotogramas/f00000.jpg…` y `guion.json` (duración y cifras leídas de la web). `--hasta 6` graba solo los 6 primeros segundos, para probar.
- `montar.js` genera la música con `musica.py` y saca `ntt-tourism-16x9.mp4` (1920×1080, 60 fps, H.264 + AAC) y `ntt-tourism-4x5.mp4` (1080×1350, con franja de titular arriba y dirección abajo). `--musica pista.wav` usa otra pista; `--sin-musica`, ninguna.
- Sin `--nombre` o `--direccion`, el cierre dice «PENDIENTE» en rojo, para que una prueba no se confunda con la toma final.

## Música

`musica.py` compone la pista aquí mismo con numpy (pads, bajo, arpegio y percusión ligera, Do – Sol – La menor – Fa a 96 pulsos por minuto). No usa muestras ni grabaciones de nadie, así que no hay licencia de terceros que cumplir: es parte de este repositorio y se publica con su misma licencia.

## Guion

| Tiempo | Imagen | Rótulo |
|---|---|---|
| 0–4 s | Portada: la pregunta palabra a palabra | ¿Qué días habrá demasiada gente en Asturias? |
| 4–10 s | El cursor avanza del 11 al 15 de agosto; el mapa se pone rojo | Del 11 al 15 de agosto… |
| 10–13 s | Zoom al Top 3 con más y con menos gente | Dónde habrá más y menos gente |
| 13–18 s | Escribe «Lagos de Cov»: se abre Cangas de Onís y el mapa vuela al Oriente | Busca cualquier lugar |
| 18–25 s | Zoom a la ficha y al día a día | Previsto y real, leídos de la ficha |
| 25–28 s | «Ver ese día»: el día alternativo con menos gente | Te propone un día mejor para ir |
| 28–32 s | Vista de lista | También en lista, sin mapa |
| 32–37 s | Funciones avanzadas: el cursor mueve el umbral | Para ayuntamientos: días de saturación del año |
| 37–41 s | Tarjeta con la cifra que sube | Error del modelo a 1–7 días frente a suponer un día normal, leído de `salidas.js` |
| 41–45 s | Cierre | Nombre, proyecto de equipo de 5 · Hackathon TalentUO 2026 y dirección |

Ninguna cifra está escrita a mano: si cambian los datos, cambian los rótulos.
