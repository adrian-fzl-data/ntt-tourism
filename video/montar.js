/* Monta el vídeo a partir de la grabación de video/grabar.js.
 *
 * Uso: node video/montar.js --salida /ruta/salida [--titular "…"] [--direccion "…"]
 *
 * Deja en la carpeta de salida:
 *   ntt-tourism-16x9.mp4  1920×1080, H.264, sin sonido (LinkedIn lo reproduce en silencio)
 *   ntt-tourism-4x5.mp4   1080×1350 para el móvil: el mismo vídeo con una franja arriba (titular) y abajo (dirección)
 * Las franjas se dibujan con la web (mismos colores y tipografía) y se superponen con ffmpeg.
 */
const { chromium } = require('playwright');
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const arg = (n, def) => { const i = process.argv.indexOf('--' + n); return i > -1 ? process.argv[i + 1] : def; };
const SALIDA = path.resolve(arg('salida', 'video-salida'));
const URL = arg('url', 'http://127.0.0.1:8731/demo/');
const TITULAR = arg('titular', 'Avisar de los días de lleno en Asturias, zona a zona');
const DIRECCION = arg('direccion', 'DIRECCIÓN PENDIENTE');
const marcas = JSON.parse(fs.readFileSync(path.join(SALIDA, 'marcas.json'), 'utf8'));
const bruto = path.join(SALIDA, 'bruto.webm');
const ff = (...a) => execFileSync('ffmpeg', ['-v', 'error', '-y', ...a], { stdio: 'inherit' });

(async () => {
  const ini = marcas.inicio.toFixed(3), dur = marcas.duracion.toFixed(3);
  const h264 = ['-c:v', 'libx264', '-preset', 'slow', '-crf', '20', '-pix_fmt', 'yuv420p', '-r', '30', '-movflags', '+faststart', '-an'];

  // 16:9: recorte exacto del guion
  const v169 = path.join(SALIDA, 'ntt-tourism-16x9.mp4');
  ff('-ss', ini, '-i', bruto, '-t', dur, ...h264, v169);

  // Franjas del 4:5, dibujadas con la propia web para heredar colores y tipografía
  const AN = 1080, AL = 1350, VID = Math.round(AN * 9 / 16 / 2) * 2, BANDA = (AL - VID) / 2;
  const b = await chromium.launch();
  const p = await (await b.newContext({ viewport: { width: AN, height: AL }, deviceScaleFactor: 1 })).newPage();
  await p.goto(URL); await p.waitForSelector('#ranking .rk');
  const pend = s => /PENDIENTE/.test(s) ? `<span style="background:var(--rojo);padding:0 .3em;border-radius:6px">${s}</span>` : s;
  await p.evaluate(([t, d, banda]) => {
    document.documentElement.style.background = 'transparent';
    document.body.style.cssText = 'margin:0;background:transparent';
    document.body.innerHTML = `
      <style>.fr{position:fixed;left:0;right:0;height:${banda}px;background:var(--acento);color:#fff;display:grid;place-content:center;
        text-align:center;padding:0 70px;box-sizing:border-box}</style>
      <div class="fr" style="top:0;font:800 64px/1.12 var(--f-titulo)">${t}</div>
      <div class="fr" style="bottom:0;font:600 40px/1.3 var(--f-titulo)">${d}</div>`;
  }, [TITULAR, pend(DIRECCION), BANDA]);
  await p.waitForTimeout(500);
  const franjas = path.join(SALIDA, 'franjas-4x5.png');
  await p.screenshot({ path: franjas, omitBackground: true });
  await b.close();

  const v45 = path.join(SALIDA, 'ntt-tourism-4x5.mp4');
  ff('-i', v169, '-i', franjas, '-filter_complex',
    `[0:v]scale=${AN}:${VID}:flags=lanczos,pad=${AN}:${AL}:0:${BANDA}:black[v];[v][1:v]overlay=0:0[o]`,
    '-map', '[o]', ...h264, v45);

  for (const f of [v169, v45]) console.log(path.basename(f), execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'stream=width,height:format=duration', '-of', 'csv=p=0', f]).toString().trim().replace(/\n/g, ' · '));
})();
