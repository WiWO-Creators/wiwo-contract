import assert from 'node:assert/strict';
import test from 'node:test';
import { audienceOf, describeManifestProblem } from '../dist/esm/index.js';

/**
 * Responsabilidad: fijar cómo se lee para quién es un sitio.
 * Usado por: `npm test`.
 * NO hace: no toca base ni red; `audienceOf` es una función pura sobre el dato.
 *
 * Lo que se cuida acá es que la OMISIÓN sea segura. El campo es opcional a
 * propósito —los sitios con una versión anterior del paquete no lo emiten— y un
 * lector que tratara "no dijo nada" como algo distinto de "público general"
 * partiría la vista del orquestador en dos por un campo que nadie escribió.
 */

/** Un manifest mínimo, con la audiencia que se le pase. */
function manifest(site = {}) {
  return {
    contract: '1.2',
    site: { name: 'Sitio', url: 'https://sitio.test', language: 'es-CL', ...site },
    capabilities: { articles: true, read: true, write: false, media: false },
    format: { id: 'sitio', label: 'Sitio', fields: [], blockTypes: [] },
    counts: { articles: 0 },
    generatedAt: '2026-09-03T00:00:00.000Z',
  };
}

test('un sitio que no declara audiencia es de público general', () => {
  assert.equal(audienceOf(manifest()), 'general');
});

test('un sitio infantil se declara y se lee como tal', () => {
  assert.equal(audienceOf(manifest({ audience: 'kids' })), 'kids');
});

test('declararse general explícitamente es lo mismo que no decir nada', () => {
  assert.equal(audienceOf(manifest({ audience: 'general' })), 'general');
});

test('una audiencia que no está en la lista se lee como general, no rompe', () => {
  // Un sitio más nuevo que quien lo lee: la lectura conservadora es tratarlo
  // como general, nunca inventarle un trato especial que no se sabe cuál es.
  assert.equal(audienceOf(manifest({ audience: 'adultos' })), 'general');
});

test('un sitio sin bloque site no revienta al preguntarle la audiencia', () => {
  assert.equal(audienceOf({ contract: '1.2' }), 'general');
});

test('la audiencia NO decide si un sitio se puede leer', () => {
  // Es la mitad del diseño: declararse infantil cambia cómo se MIRA el sitio,
  // no si el orquestador puede hablarle. Si esto empezara a rechazar sitios,
  // un valor nuevo dejaría páginas fuera sin que nadie lo pidiera.
  assert.equal(describeManifestProblem(manifest({ audience: 'kids' })), null);
  assert.equal(describeManifestProblem(manifest({ audience: 'lo-que-sea' })), null);
});
