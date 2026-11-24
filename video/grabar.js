/* Graba el vídeo de 45 s de la demo (agosto de 2024) fotograma a fotograma, a 60 fps.
 *
 * Uso (desde la raíz del repositorio, con la web servida en local):
 *   python3 -m http.server 8731
 *   node video/grabar.js --salida /ruta/salida --nombre "Nombre Apellido" --direccion "usuario.github.io/ntt-tourism"
 *
 * Cómo funciona: el reloj de la página está congelado (page.clock) y se adelanta 1/60 s entre captura y
 * captura, así que todo lo que anima la web con JavaScript (el vuelo del mapa, por ejemplo) sale fluido
 * aunque cada captura tarde lo que tarde. Encima de la web va una capa propia, también calculada
 * fotograma a fotograma: cursor, cámara (acercamientos suaves), rótulos palabra a palabra y tarjetas con
 * cifras que cuentan hasta su valor.
 *
 * Las cifras se leen de la ficha de la demo o de las métricas del modelo (datos/modelo/salidas.js); no hay
 * ninguna escrita a mano. Sin --nombre o --direccion, el cierre dice «PENDIENTE».
 *
 * Deja en la carpeta de salida: fotogramas/f00000.jpg … y guion.json. El montaje lo hace video/montar.js.
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const arg = (n, def) => { const i = process.argv.indexOf('--' + n); return i > -1 ? process.argv[i + 1] : def; };
const SALIDA = path.resolve(arg('salida', 'video-salida'));
const URL = arg('url', 'http://127.0.0.1:8731/demo/');
const NOMBRE = arg('nombre', 'NOMBRE PENDIENTE');
const DIRECCION = arg('direccion', 'DIRECCIÓN PENDIENTE');
const HASTA = parseFloat(arg('hasta', '60')); // para pruebas: grabar solo hasta este segundo
const TOTAL = 45; // duración objetivo: las dos tarjetas finales se ajustan para acabar aquí
const FPS = 60, W = 1920, H = 1080;
const DIR_F = path.join(SALIDA, 'fotogramas');
fs.rmSync(DIR_F, { recursive: true, force: true });
fs.mkdirSync(DIR_F, { recursive: true });

// Métricas del modelo (error medio a 1–7 días frente a suponer un día normal)
const met = (() => {
  const w = {};
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../demo/datos/modelo/salidas.js'), 'utf8'), { window: w });
  const g = w.SALIDAS_MODELO.metricas.tablas.global.filter(r => r.experimento === 'base');
  const v = (modelo, metodo) => g.find(r => r.modelo === modelo && r.metodo === metodo).wape;
  return { corto: v('corto', 'modelo'), normal: v('corto', 'B0') };
})();

/* ---------- Capa del vídeo (va en <html>; la cámara mueve <body>, así la capa no se deforma) ---------- */
const CAPA_CSS = `
#v-capa { position: fixed; inset: 0; z-index: 99990; pointer-events: none; font-family: var(--f-titulo); }
#v-cursor { position: absolute; left: 0; top: 0; width: 36px; height: 36px; will-change: transform; }
#v-cursor svg { width: 100%; height: 100%; filter: drop-shadow(0 3px 4px rgba(0,0,0,.35)); }
#v-onda { position: absolute; left: -22px; top: -22px; width: 44px; height: 44px; border-radius: 50%; border: 3px solid var(--acento); opacity: 0; }
#v-rotulo { position: absolute; left: 96px; bottom: 88px; display: flex; align-items: stretch; max-width: 1300px; opacity: 0; }
#v-rotulo .barra { width: 8px; border-radius: 4px; background: var(--ambar-vivo); margin-right: 22px; transform-origin: 50% 100%; }
#v-rotulo .caja { background: color-mix(in srgb, var(--tinta) 88%, transparent); -webkit-backdrop-filter: blur(12px); backdrop-filter: blur(12px);
  color: #fff; padding: 20px 30px 22px; border-radius: 18px; box-shadow: 0 18px 40px -16px rgba(0,0,0,.55); }
#v-rotulo .txt { font: 800 50px/1.12 var(--f-titulo); letter-spacing: -.01em; }
#v-rotulo .sub { font: 600 28px/1.3 var(--f-titulo); color: #d9e6dd; margin-top: 8px; }
#v-rotulo .pal { display: inline-block; white-space: pre; }
#v-tarjeta { position: absolute; inset: 0; display: grid; place-content: center; text-align: center; gap: 26px; padding: 0 180px; opacity: 0;
  background: radial-gradient(120% 120% at 50% 0%, color-mix(in srgb, var(--acento) 92%, #000) 0%, color-mix(in srgb, var(--acento) 60%, #000) 100%); color: #fff; }
#v-tarjeta .t1 { font: 800 92px/1.04 var(--f-titulo); letter-spacing: -.02em; }
#v-tarjeta .t2 { font: 700 46px/1.2 var(--f-titulo); color: #e8f1eb; }
#v-tarjeta .t3 { font: 500 30px/1.4 var(--f-titulo); color: #cfe0d5; }
#v-tarjeta .grande { font: 800 190px/1 var(--f-titulo); letter-spacing: -.03em; font-variant-numeric: tabular-nums; }
#v-tarjeta .coma { font-variant-numeric: normal; margin: 0 -.06em; }
#v-tarjeta .pendiente { background: #b3261e; padding: 0 .25em; border-radius: 10px; }
#v-tarjeta .semaforo { display: flex; gap: 18px; justify-content: center; }
#v-tarjeta .semaforo i { width: 30px; height: 30px; border-radius: 50%; display: block; }
#v-tarjeta .pal { display: inline-block; white-space: pre; }
`;
const CURSOR_SVG = '<svg viewBox="0 0 24 24"><path d="M4 2l15 11.5-6.6.9 3.9 7.6-3 1.5-3.9-7.7L4 20z" fill="#fff" stroke="#111" stroke-width="1.6" stroke-linejoin="round"/></svg>';

// Dibuja la capa con el estado V (se llama una vez por fotograma; sin transiciones CSS)
function DIBUJAR(V) {
  const $ = s => document.querySelector(s);
  const cl = x => Math.max(0, Math.min(1, x));
  const sal = x => 1 - Math.pow(1 - cl(x), 3); // ease-out cúbica
  // Cámara
  const b = document.body;
  if (V.cam.s === 1 && V.cam.tx === 0 && V.cam.ty === 0) b.style.transform = '';
  else { b.style.transformOrigin = '0 0'; b.style.transform = `translate(${V.cam.tx}px, ${V.cam.ty}px) scale(${V.cam.s})`; }
  // Cursor
  const c = $('#v-cursor');
  c.style.transform = `translate(${V.cur.x}px, ${V.cur.y}px) scale(${V.cur.pulsado ? 0.9 : 1})`;
  c.style.opacity = V.cur.vis;
  const o = $('#v-onda');
  if (V.cur.onda >= 0 && V.cur.onda <= 1) { o.style.opacity = 1 - V.cur.onda; o.style.transform = `scale(${0.4 + 1.3 * sal(V.cur.onda)})`; }
  else o.style.opacity = 0;
  // Rótulo
  const r = $('#v-rotulo');
  if (V.rot && V.rot.txt) {
    if (r.dataset.txt !== V.rot.txt + '|' + (V.rot.sub || '')) {
      r.dataset.txt = V.rot.txt + '|' + (V.rot.sub || '');
      r.querySelector('.txt').innerHTML = V.rot.txt.split(' ').map(p => `<span class="pal">${p} </span>`).join('');
      r.querySelector('.sub').innerHTML = V.rot.sub || '';
      r.querySelector('.sub').style.display = V.rot.sub ? '' : 'none';
    }
    const fuera = V.rot.fuera >= 0 ? sal(V.rot.fuera / 0.35) : 0;
    r.style.opacity = 1 - fuera;
    r.style.transform = `translateY(${fuera * 20}px)`;
    r.querySelector('.barra').style.transform = `scaleY(${sal(V.rot.t / 0.3)})`;
    r.querySelectorAll('.txt .pal').forEach((s, i) => {
      const k = sal((V.rot.t - 0.1 - i * 0.07) / 0.4);
      s.style.opacity = k; s.style.transform = `translateY(${(1 - k) * 26}px)`;
    });
    const ks = sal((V.rot.t - 0.45) / 0.4);
    r.querySelector('.sub').style.opacity = ks;
    r.querySelector('.caja').style.transform = `translateX(${(1 - sal(V.rot.t / 0.35)) * -30}px)`;
  } else r.style.opacity = 0;
  // Tarjeta a pantalla completa
  const t = $('#v-tarjeta');
  if (V.tar && V.tar.html) {
    if (t.dataset.id !== V.tar.id) { t.dataset.id = V.tar.id; t.innerHTML = V.tar.html; }
    const ent = sal(V.tar.t / 0.45), fuera = V.tar.fuera >= 0 ? sal(V.tar.fuera / 0.5) : 0;
    t.style.opacity = ent;
    t.style.clipPath = V.tar.cortina ? `inset(0 0 ${fuera * 100}% 0)` : '';
    if (!V.tar.cortina) t.style.opacity = ent * (1 - fuera);
    t.querySelectorAll('[data-orden]').forEach(e => {
      const k = sal((V.tar.t - 0.15 - (+e.dataset.orden) * 0.18) / 0.5);
      e.style.opacity = k; e.style.transform = `translateY(${(1 - k) * 30}px)`;
    });
    t.querySelectorAll('.pal').forEach((s, i) => {
      const k = sal((V.tar.t - 0.15 - i * 0.08) / 0.45);
      s.style.opacity = k; s.style.transform = `translateY(${(1 - k) * 34}px)`;
    });
    t.querySelectorAll('[data-cuenta]').forEach(e => {
      const k = sal((V.tar.t - 0.3) / 1.3), v = (+e.dataset.cuenta) * k, d = +(e.dataset.dec || 0);
      e.innerHTML = (e.dataset.signo || '') + v.toFixed(d).replace('.', '<span class="coma">,</span>') + (e.dataset.suf || '');
    });
  } else { t.style.opacity = 0; t.dataset.id = ''; }
}

(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
  const p = await ctx.newPage();
  const errores = [];
  p.on('pageerror', e => errores.push(e.message));
  await p.clock.install();
  await p.goto(URL);
  await p.waitForSelector('#ranking .rk');
  await p.waitForTimeout(1500);
  for (let i = 0; i < 4; i++) { await p.click('#btn-antes'); await p.waitForTimeout(200); }
  await p.waitForTimeout(800);
  await p.mouse.move(W - 5, H - 5); // el ratón real, fuera de la vista (el cursor que se ve es el dibujado)
  await p.addStyleTag({ content: CAPA_CSS });
  await p.evaluate(([svg, fn]) => {
    const capa = document.createElement('div'); capa.id = 'v-capa';
    capa.innerHTML = `<div id="v-tarjeta"></div><div id="v-rotulo"><div class="barra"></div><div class="caja"><div class="txt"></div><div class="sub"></div></div></div><div id="v-cursor">${svg}<div id="v-onda"></div></div>`;
    document.documentElement.appendChild(capa);
    window.__v = eval('(' + fn + ')');
  }, [CURSOR_SVG, DIBUJAR.toString()]);
  await p.clock.pauseAt(await p.evaluate(() => Date.now() + 500));

  /* ---------- Motor de fotogramas ---------- */
  let f = 0, tRot = 0;
  class Fin extends Error {}
  const V = { cam: { s: 1, tx: 0, ty: 0 }, cur: { x: W * 0.55, y: H * 0.62, vis: 0, onda: -1, pulsado: false }, rot: null, tar: null };
  const seg = () => f / FPS;
  let acabado = false;
  const escenas = {};
  const marca = n => { escenas[n] = +seg().toFixed(2); };
  async function fotograma() {
    if (seg() >= HASTA) { acabado = true; throw new Fin(); }
    if (V.rot) V.rot.t = (f - tRot) / FPS;
    if (V.tar) V.tar.t += 1 / FPS;
    await p.evaluate(v => window.__v(v), V);
    await p.screenshot({ path: path.join(DIR_F, `f${String(f).padStart(5, '0')}.jpg`), type: 'jpeg', quality: 93 });
    await p.clock.runFor(1000 / FPS);
    f++;
  }
  // Ejecuta cb(u) durante «s» segundos (u de 0 a 1) y graba cada fotograma
  async function durante(s, cb) {
    const n = Math.round(s * FPS);
    for (let i = 0; i < n && !acabado; i++) { if (cb) await cb(n > 1 ? i / (n - 1) : 1, i); await fotograma(); }
  }
  const cl = x => Math.max(0, Math.min(1, x));
  const eio = x => (x = cl(x), x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2); // ease-in-out cúbica
  const eo = x => 1 - Math.pow(1 - cl(x), 4);
  const mezcla = (a, b, k) => a + (b - a) * k;

  // Cámara: encuadra el punto (cx, cy) de la página a escala s, sin salirse de la página
  function camara(s, cx, cy) {
    let tx = W / 2 - s * cx, ty = H / 2 - s * cy;
    tx = Math.min(0, Math.max(W - s * W, tx)); ty = Math.min(0, Math.max(H - s * H, ty));
    return { s, tx, ty };
  }
  const camIgual = c => ({ s: c.s, tx: c.tx, ty: c.ty });
  async function moverCamara(s, cx, cy, dur, cb) {
    const de = camIgual(V.cam), a = camara(s, cx, cy);
    await durante(dur, async (u, i) => {
      const k = eio(u); V.cam = { s: mezcla(de.s, a.s, k), tx: mezcla(de.tx, a.tx, k), ty: mezcla(de.ty, a.ty, k) };
      if (cb) await cb(u, i);
    });
  }
  // Caja de un elemento en coordenadas de la página sin cámara (para encuadrar)
  const cajaPagina = sel => p.evaluate(s => {
    const e = document.querySelector(s); const b = document.body; const t = b.style.transform; b.style.transform = '';
    const r = e.getBoundingClientRect(); b.style.transform = t; return { x: r.x, y: r.y, w: r.width, h: r.height };
  }, sel);
  // Punto en pantalla (con la cámara actual) del centro de un elemento
  const puntoPantalla = sel => p.evaluate(s => { const r = document.querySelector(s).getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; }, sel);
  async function moverCursor(x, y, dur, cb) {
    const x0 = V.cur.x, y0 = V.cur.y;
    // trayectoria con un ligero arco, como la mano
    await durante(dur, async (u, i) => {
      const k = eo(u), arco = Math.sin(Math.PI * k) * Math.min(60, Math.hypot(x - x0, y - y0) * 0.12);
      V.cur.x = mezcla(x0, x, k); V.cur.y = mezcla(y0, y, k) - arco;
      if (cb) await cb(u, i);
    });
  }
  async function clic(sel, accion) {
    const q = await puntoPantalla(sel);
    await moverCursor(q.x, q.y, 0.45);
    V.cur.pulsado = true; await durante(0.08);
    if (accion) await accion(); else await p.evaluate(s => document.querySelector(s).click(), sel);
    V.cur.pulsado = false; V.cur.onda = 0;
    await durante(0.35, u => { V.cur.onda = u; });
    V.cur.onda = -1;
  }
  // Rótulo: aparece palabra a palabra y se mantiene; rotuloFuera() lo retira
  function rotulo(txt, sub) { V.rot = { txt, sub, t: 0, fuera: -1 }; tRot = f; }
  async function rotuloFuera(d = 0.35) { if (!V.rot) return; const f0 = f; await durante(d, () => { V.rot.fuera = (f - f0) / FPS; }); V.rot = null; }
  function tarjeta(id, html, cortina) { V.tar = { id, html, t: 0, fuera: -1, cortina }; }
  const NBSP = '\u00a0';
  const pct = x => (x * 100).toFixed(1).replace('.', ',');

  let val = { prev: '', real: '' };
  try {
  /* =================== Guion (45 s) =================== */
  // 0–4,5 s · Portada sobre el mapa: la pregunta y la promesa
  tarjeta('portada', `
    <div class="semaforo" data-orden="0"><i style="background:var(--rojo)"></i><i style="background:var(--ambar-vivo)"></i><i style="background:var(--mapa-verde)"></i></div>
    <div class="t1">${'¿Qué días habrá demasiada gente en Asturias?'.split(' ').map(w => `<span class="pal">${w} </span>`).join('')}</div>
    <div class="t2" data-orden="4">Un semáforo que lo avisa con días de antelación, zona a zona</div>`, true);
  V.tar.t = 0.2;
  await durante(3.1);
  await durante(0.6, u => { V.tar.fuera = u * 0.5; });
  V.tar = null;
  V.cam = camara(1.08, W / 2, H / 2);

  // 4,1–10 s · Del 11 al 15 de agosto: el mapa se enciende
  V.cur.vis = 1;
  rotulo('Del 11 al 15 de agosto…', 'Verde, lo normal · ámbar, +50 % · rojo, el doble o más');
  await moverCamara(1, W / 2, H / 2, 0.9);
  marca('dias');
  for (let i = 0; i < 4; i++) { await clic('#btn-despues'); await durante(0.55); }
  await rotuloFuera();

  // 10–13 s · Top 3 con más y con menos gente
  marca('top3');
  const rk = await cajaPagina('#ranking');
  rotulo('Dónde habrá más y menos gente');
  await moverCamara(1.75, rk.x + rk.w / 2 + 60, rk.y + Math.min(rk.h, 520) / 2, 1.1, u => { V.cur.vis = 1 - u; });
  await durante(1.1);
  await rotuloFuera(0.3);

  // 13–18 s · Buscar «Lagos de Covadonga»: se abre la zona y el mapa vuela al Oriente
  await moverCamara(1, W / 2, H / 2, 0.8, u => { V.cur.vis = u; });
  marca('busqueda');
  rotulo('Busca cualquier lugar', 'Lagos de Covadonga');
  await clic('#buscar', () => p.evaluate(() => document.querySelector('#buscar').focus()));
  const texto = 'Lagos de Cov';
  for (const ch of texto) {
    await p.evaluate(c => { const i = document.querySelector('#buscar'); i.value += c; i.dispatchEvent(new Event('input', { bubbles: true })); }, ch);
    await durante(0.07);
  }
  await durante(0.35);
  await p.keyboard.press('ArrowDown'); await durante(0.15);
  await p.keyboard.press('Enter');
  const titulo = await p.textContent('#pz-titulo');
  if (!/Cangas de Onís/.test(titulo)) throw new Error('La búsqueda no abrió Cangas de Onís: ' + titulo);
  await moverCursor(W - 300, 700, 0.5);
  await durante(0.9);
  await rotuloFuera(0.3);

  // 18–25 s · La ficha: previsto frente a lo que pasó, y el día a día
  marca('ficha');
  val = await p.evaluate(() => {
    const ficha = document.querySelector('#panel-zona');
    const real = [...ficha.querySelectorAll('.pz-cifra')].find(e => e.textContent.includes('Lo que pasó de verdad'));
    const prev = ficha.querySelector('.pz-estado .pz-delta');
    return { real: real.textContent.replace(/\s+/g, ' '), prev: prev.textContent };
  });
  const num = s => { const m = s.match(/([+−-])\s?(\d[\d.]*)\s?%/); return m ? { signo: m[1], v: +m[2].replace('.', '') } : null; };
  const nPrev = num(val.prev), nReal = num(val.real);
  if (!nPrev || !nReal) throw new Error('No encuentro las cifras de la ficha: ' + JSON.stringify(val));
  const est = await cajaPagina('#panel-zona .pz-estado');
  V.cur.vis = 0;
  await moverCamara(1.9, est.x + est.w / 2 - 120, est.y + est.h / 2 + 40, 1.1);
  rotulo(`Previsto ${nPrev.signo}${nPrev.v}${NBSP}% · Real ${nReal.signo}${nReal.v}${NBSP}%`, '15 de agosto de 2024, Cangas de Onís y los Lagos');
  await durante(2.1);
  await rotuloFuera(0.3);
  const dd = await cajaPagina('#pz-s-a');
  rotulo('Y cómo evoluciona día a día');
  await moverCamara(1.6, dd.x + 120, dd.y + 150, 0.9);
  await durante(1.2);
  await rotuloFuera(0.3);

  // 25–28 s · Propone un día con menos gente: «Ver ese día»
  await moverCamara(1, W / 2, H / 2, 0.7, u => { V.cur.vis = u; });
  marca('mejor');
  rotulo('Te propone un día mejor para ir');
  const hayMejor = await p.$('#panel-zona .mm .btn-mini');
  if (hayMejor) await clic('#panel-zona .mm .btn-mini');
  await durante(1.3);
  await rotuloFuera(0.3);

  // 28–32,5 s · Vista de lista
  marca('lista');
  rotulo('También en lista, sin mapa');
  await clic('#pz-cerrar');
  await clic('[data-vista="lista"]');
  await durante(0.6);
  const lt = await cajaPagina('#lista-zonas');
  await moverCamara(1.35, lt.x + lt.w / 2, lt.y + 330, 1.0, u => { V.cur.vis = 1 - u; });
  await durante(0.8);
  await rotuloFuera(0.3);

  // 32,5–37,5 s · Funciones avanzadas: días de saturación del año
  await moverCamara(1, W / 2, H / 2, 0.6, u => { V.cur.vis = u; });
  marca('avanzadas');
  rotulo('Para ayuntamientos: días de saturación del año', 'Funciones avanzadas');
  await clic('#tab-gestion');
  await durante(0.3);
  const cu = await cajaPagina('#umbral');
  await moverCamara(1.45, cu.x + cu.w / 2 + 320, cu.y + 190, 0.7);
  const um = await puntoPantalla('#umbral');
  const r0 = await p.evaluate(() => { const r = document.querySelector('#umbral'); return { v: +r.value, max: +r.max, min: +r.min, x: r.getBoundingClientRect().x, w: r.getBoundingClientRect().width }; });
  const xPulgar = v => r0.x + (v - r0.min) / (r0.max - r0.min) * r0.w;
  await moverCursor(xPulgar(r0.v), um.y, 0.5);
  const objetivo = Math.max(r0.min, r0.v - Math.round((r0.max - r0.min) * 0.35));
  let ultimo = r0.v;
  V.cur.pulsado = true;
  await durante(1.6, async u => {
    const v = Math.round(mezcla(r0.v, objetivo, eio(u)));
    V.cur.x = xPulgar(mezcla(r0.v, objetivo, eio(u)));
    if (v !== ultimo) { ultimo = v; await p.evaluate(x => { const r = document.querySelector('#umbral'); r.value = x; r.dispatchEvent(new Event('input', { bubbles: true })); r.dispatchEvent(new Event('change', { bubbles: true })); }, v); }
  });
  V.cur.pulsado = false;
  await durante(0.9);
  await rotuloFuera(0.3);

  // 37,5–41 s · Tarjeta: el error del modelo
  marca('error');
  const quedan = TOTAL - seg(); // lo que queda para las dos tarjetas: 45 % error, 55 % cierre, con mínimos
  const tError = Math.max(2.8, quedan * 0.45), tCierre = Math.max(3.4, quedan - tError);
  V.cur.vis = 0;
  tarjeta('error', `
    <div class="grande"><span data-cuenta="${(met.corto * 100).toFixed(1)}" data-dec="1" data-suf="${NBSP}%">0</span></div>
    <div class="t2" data-orden="1">de error medio, frente al ${pct(met.normal)}${NBSP}% de suponer un día normal</div>
    <div class="t3" data-orden="2">Previsión a 1–7 días, validada con días que el modelo no vio al entrenar</div>`);
  await durante(tError);

  // 41–45 s · Cierre
  marca('cierre');
  const pend = s => /PENDIENTE/.test(s) ? `<span class="pendiente">${s}</span>` : s;
  tarjeta('cierre', `
    <div class="semaforo" data-orden="0"><i style="background:var(--rojo)"></i><i style="background:var(--ambar-vivo)"></i><i style="background:var(--mapa-verde)"></i></div>
    <div class="t1" data-orden="1">${pend(NOMBRE)}</div>
    <div class="t2" data-orden="2">NTT Tourism · Proyecto de equipo de 5 · Hackathon TalentUO 2026</div>
    <div class="t3" data-orden="3">${pend(DIRECCION)}</div>`);
  await durante(tCierre);
  } catch (e) { if (!(e instanceof Fin)) throw e; }

  await ctx.close(); await b.close();
  const guion = { fps: FPS, fotogramas: f, duracion: f / FPS, escenas, cifras: { previsto: val.prev, real: val.real, error: met }, errores };
  fs.writeFileSync(path.join(SALIDA, 'guion.json'), JSON.stringify(guion, null, 2));
  console.log(JSON.stringify(guion, null, 2));
})();
