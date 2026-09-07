import assert from 'node:assert/strict';
import test from 'node:test';
import { allArticles, createArticlesHandlers } from '../dist/esm/server.js';

/**
 * Responsabilidad: fijar que la dirección de una nota se resuelve con la NOTA a
 * mano y no solo con su identificador, al leer y al publicar por igual.
 * Usado por: `npm test`.
 * NO hace: no toca base ni red; el almacén se inyecta.
 *
 * Existe por un sitio con seis secciones que se dibujan distinto: ahí la
 * dirección depende de en cuál está la pieza, y eso vive en la pieza. Con solo
 * el id, ese sitio devolvía la portada para todo lo que publicaba el
 * orquestador, porque el id lo propone el orquestador a partir del título y no
 * lleva la sección adentro. Se cuidan los dos caminos porque son dos: lo que
 * sale al leer el archivo y lo que se contesta al aceptar la nota. Uno solo
 * arreglado deja al orquestador guardando una dirección y mostrando otra.
 */

const CLAVE = 'clave-de-prueba';

/** Una nota como la guarda un sitio, con su sección. */
function nota(id, seccion) {
  return {
    id,
    title: 'Una pieza',
    summary: 'La bajada',
    section: { id: seccion, label: seccion },
    publishedAt: '2026-09-01',
    updatedAt: '2026-09-01',
    body: { format: 'markdown', markdown: '# Hola' },
    image: null,
    tags: [],
    extra: {},
  };
}

/** Un sitio cuya dirección sale de la SECCIÓN, que el id no lleva. */
function sitioPorSeccion(archivo = [], publicadas = []) {
  return {
    store: {
      read: async () => publicadas,
      find: async () => null,
      save: async () => {},
      remove: async () => false,
    },
    archive: () => archivo,
    fields: () => [],
    urlFor: (id, origin, article) =>
      new URL(`/${article.section.id}/${id}`, origin).toString(),
  };
}

test('al leer, la dirección se arma con la nota entera', async () => {
  const config = sitioPorSeccion([nota('mi-nota', 'leer')]);

  const [articulo] = await allArticles(config, 'https://sitio.test');

  assert.equal(articulo.url, 'https://sitio.test/leer/mi-nota');
});

test('al publicar, se contesta la misma dirección que se leería después', async () => {
  process.env.WIWO_WRITE_TOKEN = CLAVE;
  const config = sitioPorSeccion();
  const handlers = createArticlesHandlers(config);

  const respuesta = await handlers.POST({
    request: new Request('https://sitio.test/api/wiwo/v1/articles', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${CLAVE}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ ...nota('mi-nota', 'leer'), id: 'mi-nota' }),
    }),
  });

  const cuerpo = await respuesta.json();
  assert.equal(respuesta.status, 201);
  assert.equal(cuerpo.url, 'https://sitio.test/leer/mi-nota');
});

test('un sitio de una sola ruta puede seguir ignorando la nota', async () => {
  // La mayoría: dos parámetros, como estaba escrito antes de que el tercero
  // existiera. Si esto dejara de funcionar habría que tocar los cinco sitios.
  const config = {
    ...sitioPorSeccion([nota('mi-nota', 'leer')]),
    urlFor: (id, origin) => new URL(`/articulo/${id}`, origin).toString(),
  };

  const [articulo] = await allArticles(config, 'https://sitio.test');

  assert.equal(articulo.url, 'https://sitio.test/articulo/mi-nota');
});
