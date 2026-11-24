/* Graba el vídeo de 30 s de la demo (agosto de 2024) con Playwright.
 *
 * Uso (desde la raíz del repositorio, con la web servida en local):
 *   python3 -m http.server 8731
 *   node video/grabar.js --salida /ruta/salida [--nombre "Nombre Apellido"] [--direccion "usuario.github.io/ntt-tourism"]
 *
 * Mientras falten el nombre o la dirección, el cierre muestra «PENDIENTE»: así una prueba nunca se confunde
 * con la toma final. Las cifras de los rótulos se leen de la propia demo o de las métricas del modelo
 * (datos/modelo/salidas.js); no hay ninguna escrita a mano.
 *
 * Deja en la carpeta de salida: bruto.webm (la grabación entera) y marcas.json (en qué segundo empieza
 * el guion). El montaje en MP4 16:9 y 4:5 lo hace video/montar.js.
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const arg = (n, def) => { const i = process.argv.indexOf('--' + n); return i > -1 ? process.argv[i + 1] : def; };
const SALIDA = path.resolve(arg('salida', 'video-salida'));
const URL = arg('url', 'http://127.0.0.1:8731/demo/');
const NOMBRE = arg('nombre', 'NOMBRE PENDIENTE');
const DIRECCION = arg('direccion', 'DIRECCIÓN PENDIENTE');
const ZONA = '33012'; // Cangas de Onís (incluye Covadonga y Lagos)
const W = 1920, H = 1080;

fs.mkdirSync(SALIDA, { recursive: true });

// Capa del vídeo: cursor dibujado, rótulo inferior, tarjetas a pantalla completa. Usa las variables de color de la web.
// Va colgada de <html> y el zoom se aplica a <body>, para que el zoom no mueva la propia capa.
const CAPA_CSS = `
#v-cursor { position: fixed; left: 0; top: 0; z-index: 99999; pointer-events: none; width: 34px; height: 34px;
  transform: translate(-100px, -100px); transition: transform var(--v-dur, 600ms) cubic-bezier(0.23, 1, 0.32, 1), opacity 200ms ease-out; }
#v-cursor svg { width: 100%; height: 100%; filter: drop-shadow(0 2px 3px rgba(0,0,0,.35)); }
#v-cursor.clic::after { content: ''; position: absolute; left: -14px; top: -14px; width: 28px; height: 28px; border-radius: 50%;
  border: 3px solid var(--acento); animation: v-onda 450ms ease-out forwards; }
@keyframes v-onda { from { transform: scale(.4); opacity: 1; } to { transform: scale(1.6); opacity: 0; } }
#v-rotulo { position: fixed; left: 50%; bottom: 72px; z-index: 99998; pointer-events: none; width: max-content; max-width: 1600px;
  transform: translate(-50%, 12px); opacity: 0; transition: opacity 300ms ease-out, transform 300ms cubic-bezier(0.23, 1, 0.32, 1);
  background: var(--tinta); color: var(--superficie); font: 700 44px/1.2 var(--f-titulo); padding: 18px 34px; border-radius: 18px; text-align: center; }
#v-rotulo.ver { opacity: 1; transform: translate(-50%, 0); }
#v-tarjeta { position: fixed; inset: 0; z-index: 99997; display: grid; place-content: center; gap: 22px; text-align: center;
  background: var(--bg); color: var(--tinta); opacity: 0; transition: opacity 400ms ease-out; pointer-events: none; padding: 0 160px; }
#v-tarjeta.ver { opacity: 1; }
#v-tarjeta .grande { font: 800 104px/1.05 var(--f-titulo); color: var(--acento); }
#v-tarjeta .medio { font: 700 52px/1.2 var(--f-titulo); }
#v-tarjeta .peque { font: 500 34px/1.35 var(--f-titulo); color: var(--tinta-2); }
#v-tarjeta .pendiente { color: var(--rojo); }
body.v-zoom { transition: transform 900ms cubic-bezier(0.23, 1, 0.32, 1); }
`;
const CURSOR_SVG = '<svg viewBox="0 0 24 24"><path d="M4 2l15 11.5-6.6.9 3.9 7.6-3 1.5-3.9-7.7L4 20z" fill="#fff" stroke="#111" stroke-width="1.6" stroke-linejoin="round"/></svg>';

(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1, recordVideo: { dir: SALIDA, size: { width: W, height: H } } });
  const p = await ctx.newPage();
  const tGrab = Date.now();
  const errores = [];
  p.on('pageerror', e => errores.push(e.message));
  const espera = ms => p.waitForTimeout(ms);

  await p.goto(URL);
  await p.waitForSelector('#ranking .rk');
  await espera(1500);

  // Cifras: la validación de la zona en el 15 de agosto se lee de la ficha; el error, de las métricas del modelo
  const met = (() => {
    const w = {}; require('vm').runInNewContext(fs.readFileSync(path.join(__dirname, '../demo/datos/modelo/salidas.js'), 'utf8'), { window: w });
    const g = w.SALIDAS_MODELO.metricas.tablas.global.filter(r => r.experimento === 'base');
    const v = (modelo, metodo) => g.find(r => r.modelo === modelo && r.metodo === metodo).wape;
    return { corto: v('corto', 'modelo'), largo: v('largo', 'modelo'), normal: v('corto', 'B0') };
  })();
  const pct = x => (x * 100).toFixed(1).replace('.', ',') + ' %';

  // Punto de partida, fuera del vídeo: 11 de agosto (cuatro días antes del 15)
  for (let i = 0; i < 4; i++) { await p.click('#btn-antes'); await espera(250); }
  await espera(1200);

  await p.addStyleTag({ content: CAPA_CSS });
  await p.evaluate(svg => {
    const c = document.createElement('div'); c.id = 'v-cursor'; c.innerHTML = svg; document.documentElement.appendChild(c);
    const r = document.createElement('div'); r.id = 'v-rotulo'; document.documentElement.appendChild(r);
    const t = document.createElement('div'); t.id = 'v-tarjeta'; document.documentElement.appendChild(t);
  }, CURSOR_SVG);

  let cx = W * 0.62, cy = H * 0.72;
  async function mover(x, y, ms = 700) {
    await p.evaluate(([x, y, ms]) => { const c = document.getElementById('v-cursor'); c.style.setProperty('--v-dur', ms + 'ms'); c.style.transform = `translate(${x}px, ${y}px)`; }, [x, y, ms]);
    await p.mouse.move(x, y, { steps: Math.max(2, Math.round(ms / 40)) });
    cx = x; cy = y;
    await espera(ms * 0.15);
  }
  async function clic(sel) {
    const bb = await p.locator(sel).first().boundingBox();
    await mover(bb.x + bb.width / 2, bb.y + bb.height / 2, 500);
    await p.evaluate(() => { const c = document.getElementById('v-cursor'); c.classList.remove('clic'); void c.offsetWidth; c.classList.add('clic'); });
    await p.mouse.click(cx, cy);
  }
  const rotulo = (txt) => p.evaluate(t => { const r = document.getElementById('v-rotulo'); if (t) r.textContent = t; r.classList.toggle('ver', !!t); }, txt);
  const tarjeta = (html) => p.evaluate(h => { const t = document.getElementById('v-tarjeta'); if (h) t.innerHTML = h; t.classList.toggle('ver', !!h); }, html);
  const marca = () => (Date.now() - tGrab) / 1000;

  await p.evaluate(([x, y]) => { document.getElementById('v-cursor').style.transform = `translate(${x}px, ${y}px)`; }, [cx, cy]);
  await espera(300);

  /* ===== Guion: empieza el vídeo ===== */
  const inicio = marca();
  const verCursor = v => p.evaluate(v => { document.getElementById('v-cursor').style.opacity = v ? '1' : '0'; }, v);

  // 0–3 s: el mapa ya pintado y la pregunta (el cursor va por el panel, sin pasar por el mapa)
  await rotulo('¿Qué día no conviene ir a los Lagos?');
  const bd = await p.locator('#btn-despues').boundingBox();
  await mover(bd.x + bd.width / 2, bd.y + bd.height / 2, 2300);
  await espera(400);

  // 3–8 s: avanzar días hasta el 15 de agosto; el mapa pasa a ámbar y rojo
  await rotulo(null);
  for (let i = 0; i < 4; i++) { await clic('#btn-despues'); await espera(950); }

  // 8–10,5 s: buscar «Lagos»; se abre la zona de Cangas de Onís y el mapa se acerca al Oriente
  await clic('#buscar');
  await p.keyboard.type('Lagos de Cov', { delay: 75 });
  await espera(500);
  await p.keyboard.press('ArrowDown'); await espera(150);
  await p.keyboard.press('Enter');
  await espera(1300);
  const titulo = await p.textContent('#panel-zona h2, #pz-titulo');
  if (!/Cangas de Onís/.test(titulo)) throw new Error('La búsqueda no abrió Cangas de Onís: ' + titulo);

  // 10,5–17 s: la ficha: día a día, por qué y el mejor día alternativo
  await mover(W - 330, 150, 350);
  await mover(W - 330, 620, 450);
  const bajar = sel => p.evaluate(s => { const h = document.querySelector(s), l = document.querySelector('.col-lateral.con-panel');
    l.scrollTo({ top: h.getBoundingClientRect().top - l.getBoundingClientRect().top + l.scrollTop - 12, behavior: 'smooth' }); }, sel);
  await bajar('#pz-s-a'); await espera(1700);
  await bajar('#pz-s-b'); await espera(1900);
  await bajar('#pz-s-c'); await espera(2000);

  // 17–22 s: zoom al dato de validación (lo previsto frente a lo que pasó)
  await p.evaluate(() => document.querySelector('.col-lateral.con-panel').scrollTo({ top: 0, behavior: 'smooth' }));
  await verCursor(false);
  await p.waitForFunction(() => document.querySelector('.col-lateral.con-panel').scrollTop === 0);
  await espera(150);
  const val = await p.evaluate(() => {
    const ficha = document.querySelector('#panel-zona');
    const real = [...ficha.querySelectorAll('.pz-cifra')].find(e => e.textContent.includes('Lo que pasó de verdad'));
    const previsto = [...ficha.querySelectorAll('*')].find(e => e.children.length === 0 && /sobre un día normal$/.test(e.textContent.trim()) && !real.contains(e));
    const caja = real.parentElement.getBoundingClientRect();
    return { real: real.textContent.replace(/\s+/g, ' ').trim(), previsto: previsto ? previsto.textContent.trim() : '', caja: { x: caja.x, y: caja.y, w: caja.width, h: caja.height } };
  });
  const mReal = val.real.match(/([+−-]\s?\d[\d.]*\s?%)/), mPrev = val.previsto.match(/([+−-]\s?\d[\d.]*\s?%)/);
  if (!mReal || !mPrev) throw new Error('No encuentro las cifras de validación en la ficha: ' + JSON.stringify(val));
  const txtVal = `Previsto ${mPrev[1]} · real ${mReal[1]} · agosto de 2024`;
  // Escala y desplaza para dejar el recuadro de validación en el centro, por encima del rótulo
  const esc = Math.min(1.9, (W * 0.6) / val.caja.w, (H * 0.55) / val.caja.h);
  const tx = W / 2 - esc * (val.caja.x + val.caja.w / 2), ty = H * 0.42 - esc * (val.caja.y + val.caja.h / 2);
  await p.evaluate(([e, tx, ty]) => { const h = document.body; h.classList.add('v-zoom'); h.style.transformOrigin = '0 0'; h.style.transform = `translate(${tx}px, ${ty}px) scale(${e})`; }, [esc, tx, ty]);
  await espera(500);
  await rotulo(txtVal);
  await espera(3900);

  // 22–26 s: tarjeta con el error del modelo frente a suponer un día normal
  await rotulo(null);
  await tarjeta(`<div class="grande">${pct(met.corto)} de error</div>
    <div class="medio">frente al ${pct(met.normal)} de suponer un día normal</div>
    <div class="peque">Error medio de la previsión a 1–7 días, validado con días que el modelo no vio al entrenar</div>`);
  await espera(450);
  await p.evaluate(() => { document.body.style.transform = ''; });
  await espera(3550);

  // 26–30 s: cierre
  const pend = s => /PENDIENTE/.test(s) ? `<span class="pendiente">${s}</span>` : s;
  await tarjeta(`<div class="medio">Proyecto de equipo de 5 · Hackathon TalentUO 2026</div>
    <div class="grande" style="color:var(--tinta)">${pend(NOMBRE)}</div>
    <div class="peque">${pend(DIRECCION)}</div>`);
  await espera(3600);
  const fin = marca();

  await ctx.close(); await b.close();
  const webm = fs.readdirSync(SALIDA).filter(f => f.endsWith('.webm')).map(f => path.join(SALIDA, f)).sort((a, c) => fs.statSync(c).mtimeMs - fs.statSync(a).mtimeMs)[0];
  fs.renameSync(webm, path.join(SALIDA, 'bruto.webm'));
  const marcas = { inicio, fin, duracion: fin - inicio, rotulo_validacion: txtVal, metricas: met, errores };
  fs.writeFileSync(path.join(SALIDA, 'marcas.json'), JSON.stringify(marcas, null, 2));
  console.log(JSON.stringify(marcas, null, 2));
})();
