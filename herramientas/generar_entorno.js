/* Genera demo/interfaz/geo-entorno.js: las provincias vecinas de Asturias, solo para dibujar tierra
 * alrededor (sin datos ni interacción).
 *
 * Fuente: provincias del paquete npm es-atlas 0.6.0 (código MIT), con geometría del Instituto
 * Geográfico Nacional (CC BY 4.0), la misma fuente y licencia que los límites de los concejos.
 *
 * Uso: npm pack es-atlas@0.6.0 && tar xzf es-atlas-0.6.0.tgz
 *      node herramientas/generar_entorno.js package/es/provinces.json
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const entrada = process.argv[2];
if (!entrada) { console.error('Falta la ruta de provinces.json de es-atlas'); process.exit(1); }
const ctx = { window: {} }; ctx.self = ctx.window;
vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../demo/vendor/topojson-client.min.js'), 'utf8'), ctx);
const topojson = ctx.window.topojson || ctx.topojson;
const topo = JSON.parse(fs.readFileSync(entrada, 'utf8'));

// Recuadro de lo que se ve alrededor de Asturias con el mapa más alejado
const CAJA = { oeste: -8.9, este: -2.6, sur: 41.8, norte: 44.4 };
const dentro = c => c.some(([x, y]) => x >= CAJA.oeste && x <= CAJA.este && y >= CAJA.sur && y <= CAJA.norte);
const red = n => Math.round(n * 1000) / 1000;
const limpiar = anillo => anillo.map(([x, y]) => [red(x), red(y)]).filter((p, i, a) => !i || p[0] !== a[i - 1][0] || p[1] !== a[i - 1][1]);

const provincias = topojson.feature(topo, topo.objects.provinces).features
  .filter(f => f.id !== '33')
  .filter(f => {
    const pol = f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates;
    return pol.some(p => dentro(p[0]));
  })
  .map(f => {
    const pol = (f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates)
      .filter(p => dentro(p[0]))
      .map(p => p.map(limpiar));
    return { type: 'Feature', properties: { nombre: f.properties.name }, geometry: { type: 'MultiPolygon', coordinates: pol } };
  });

const salida = path.join(__dirname, '../demo/interfaz/geo-entorno.js');
fs.writeFileSync(salida,
  '/* Provincias vecinas de Asturias, solo para dibujar tierra alrededor del mapa (sin datos).\n' +
  ' * Geometría: Instituto Geográfico Nacional (CC BY 4.0), vía el paquete es-atlas 0.6.0.\n' +
  ' * Generado con herramientas/generar_entorno.js; no editar a mano. */\n' +
  'window.GeoEntorno = ' + JSON.stringify({ type: 'FeatureCollection', features: provincias }) + ';\n');
console.log(provincias.map(f => f.properties.nombre).join(', '), '→', (fs.statSync(salida).size / 1024).toFixed(0), 'KB');
