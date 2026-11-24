# Vídeo de 30 s de la demo

Grabación real de la demo de agosto de 2024 con Playwright: cursor dibujado, rótulos y un zoom con CSS. No hay animación aparte ni música.

```bash
python3 -m http.server 8731                      # desde la raíz del repositorio
node video/grabar.js --salida salida-video --nombre "Nombre Apellido" --direccion "usuario.github.io/ntt-tourism"
node video/montar.js --salida salida-video --direccion "usuario.github.io/ntt-tourism"
```

Sale `ntt-tourism-16x9.mp4` (1920×1080) y `ntt-tourism-4x5.mp4` (1080×1350, con franja de titular arriba y dirección abajo). Sin `--nombre` o `--direccion`, el cierre dice «PENDIENTE» en rojo, para que una prueba no se confunda con la toma final.

| Tiempo | Imagen | Rótulo |
|---|---|---|
| 0–3 s | Mapa del 11 de agosto | ¿Qué día no conviene ir a los Lagos? |
| 3–8 s | El cursor avanza día a día hasta el 15; el mapa se pone rojo | — |
| 8–10 s | Busca «Lagos de Covadonga»: se abre Cangas de Onís y el mapa se acerca al Oriente | — |
| 10–17 s | Ficha: día a día, por qué y mejor día alternativo | — |
| 17–22 s | Zoom al dato de validación | Previsto y real, leídos de la ficha |
| 22–26 s | Tarjeta | Error del modelo frente a suponer un día normal, leído de `salidas.js` |
| 26–30 s | Cierre | Proyecto de equipo de 5 · Hackathon TalentUO 2026, nombre y dirección |

Ninguna cifra está escrita a mano: si cambian los datos, cambian los rótulos.
