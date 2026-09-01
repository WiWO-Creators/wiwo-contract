import assert from 'node:assert/strict';
import test from 'node:test';
import {
  WIWO_MEDIA_MAX_BYTES,
  WIWO_MEDIA_TYPES,
  mediaContentType,
  mediaId,
  parseMediaUpload,
} from '../dist/esm/media.js';

/**
 * Responsabilidad: fijar que acepta y que rechaza la mitad de medios.
 * Usado por: `npm test`.
 * NO hace: no toca base ni red; parseMediaUpload solo lee una Request.
 */

/** Una peticion de subida, como la arma el orquestador. */
function subida(bytes, contentType = 'image/png') {
  return new Request('https://sitio.test/api/wiwo/v1/media', {
    method: 'POST',
    headers: { 'content-type': contentType },
    body: bytes,
  });
}

test('acepta los formatos que declara y los identifica con su extension', async () => {
  const archivo = await parseMediaUpload(subida(new Uint8Array([1, 2, 3])));
  assert.equal(archivo.contentType, 'image/png');
  assert.equal(archivo.bytes, 3);
  assert.match(archivo.id, /^[0-9a-f]{32}\.png$/);
});

test('rechaza SVG aunque sea una imagen', async () => {
  // Un SVG es un documento que puede traer script adentro. Servirlo desde el
  // dominio del sitio lo volveria una via de inyeccion contra sus lectores.
  const error = await parseMediaUpload(
    subida(new Uint8Array([1]), 'image/svg+xml'),
  );
  assert.equal(error.code, 'validation');
  assert.ok(!('bytes' in error));
});

test('rechaza lo que no es imagen', async () => {
  const error = await parseMediaUpload(subida(new Uint8Array([1]), 'application/pdf'));
  assert.equal(error.code, 'validation');
});

test('ignora los parametros del content-type', async () => {
  const archivo = await parseMediaUpload(
    subida(new Uint8Array([1]), 'image/jpeg; charset=binary'),
  );
  assert.equal(archivo.contentType, 'image/jpeg');
});

test('rechaza un archivo vacio', async () => {
  const error = await parseMediaUpload(subida(new Uint8Array([])));
  assert.equal(error.code, 'validation');
  assert.match(error.message, /vac/i);
});

test('rechaza lo que pasa del tope, mirando los bytes de verdad', async () => {
  const grande = new Uint8Array(WIWO_MEDIA_MAX_BYTES + 1);
  const error = await parseMediaUpload(subida(grande));
  assert.equal(error.code, 'validation');
  assert.match(error.message, /MB/);
});

test('el mismo archivo da el mismo identificador, y otro da otro', async () => {
  // De ahi salen dos cosas: subir dos veces lo mismo no acumula copias, y la
  // URL se puede cachear para siempre porque no puede cambiar de contenido.
  const uno = await mediaId(new Uint8Array([1, 2, 3]), 'image/png');
  const igual = await mediaId(new Uint8Array([1, 2, 3]), 'image/png');
  const otro = await mediaId(new Uint8Array([1, 2, 4]), 'image/png');

  assert.equal(uno, igual);
  assert.notEqual(uno, otro);
});

test('el identificador dice como servir el archivo', () => {
  assert.equal(mediaContentType('abc.webp'), 'image/webp');
  assert.equal(mediaContentType('abc.jpg'), 'image/jpeg');
  // Sin esto, cualquier cadena de la URL llegaria a la consulta.
  assert.equal(mediaContentType('../../etc/passwd'), null);
  assert.equal(mediaContentType('abc.svg'), null);
});

test('todas las extensiones declaradas se pueden volver a leer', () => {
  for (const [tipo, extension] of Object.entries(WIWO_MEDIA_TYPES)) {
    assert.equal(mediaContentType(`x.${extension}`), tipo);
  }
});
