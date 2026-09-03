import assert from 'node:assert/strict';
import test from 'node:test';
import { createArticlesHandlers } from '../dist/esm/server.js';

/**
 * Responsabilidad: fijar qué borra y qué NO borra el contrato.
 * Usado por: `npm test`.
 * NO hace: no toca base ni red. El almacén se inyecta, así que el manejador se
 *   puede ejercitar entero sin Postgres.
 *
 * Lo que se cuida acá es la diferencia entre "no estaba" y "se borró": es lo
 * único que distingue una nota del archivo editorial del sitio —que vive en su
 * código y no se puede borrar por API— de una que el orquestador publicó.
 */

const CLAVE = 'clave-de-prueba';

/** Un sitio de mentira, con las notas que se le pasen ya publicadas. */
function sitio(publicadas = ['nota-publicada']) {
  const enLaBase = new Set(publicadas);

  return {
    borradas: [],
    config: {
      store: {
        read: async () => [],
        find: async () => null,
        save: async () => {},
        remove: async (id) => enLaBase.delete(id),
      },
      archive: () => [],
      fields: () => [],
      urlFor: (id) => `https://sitio.test/notas/${id}`,
    },
  };
}

/** El pedido de borrado tal como lo manda el orquestador. */
function pedido(id, { clave = CLAVE } = {}) {
  const url = new URL('https://sitio.test/api/wiwo/v1/articles');
  if (id !== undefined) url.searchParams.set('id', id);

  return new Request(url, {
    method: 'DELETE',
    headers: clave ? { authorization: `Bearer ${clave}` } : {},
  });
}

test.beforeEach(() => {
  process.env.WIWO_WRITE_TOKEN = CLAVE;
});

test('borra una nota que el orquestador publicó', async () => {
  const { config } = sitio(['nota-publicada']);
  const handlers = createArticlesHandlers(config);

  const respuesta = await handlers.DELETE({ request: pedido('nota-publicada') });

  assert.equal(respuesta.status, 200);
  assert.deepEqual(await respuesta.json(), {
    id: 'nota-publicada',
    deleted: true,
  });
});

test('contesta 404 cuando esa nota no está en la base', async () => {
  // Es el caso del archivo editorial: la nota se ve en el sitio pero vive en su
  // repositorio. El mensaje tiene que decirlo, porque "no se pudo" a secas manda
  // a revisar la clave o la conexión por algo que ninguna de las dos arregla.
  const { config } = sitio([]);
  const handlers = createArticlesHandlers(config);

  const respuesta = await handlers.DELETE({ request: pedido('nota-del-archivo') });
  const cuerpo = await respuesta.json();

  assert.equal(respuesta.status, 404);
  assert.equal(cuerpo.code, 'not_found');
  assert.match(cuerpo.message, /repositorio/i);
});

test('no borra sin la clave del sitio', async () => {
  const { config } = sitio(['nota-publicada']);
  const handlers = createArticlesHandlers(config);

  const respuesta = await handlers.DELETE({
    request: pedido('nota-publicada', { clave: null }),
  });

  assert.equal(respuesta.status, 401);
  // Y la nota sigue ahí: un rechazo no puede haber borrado nada.
  const segunda = await handlers.DELETE({ request: pedido('nota-publicada') });
  assert.equal(segunda.status, 200);
});

test('no borra sin identificador', async () => {
  const { config } = sitio();
  const handlers = createArticlesHandlers(config);

  const respuesta = await handlers.DELETE({ request: pedido(undefined) });

  // 400 y no 422: el 422 es para una nota que se leyó bien y no cumple lo que el
  // sitio pide, campo por campo. Un pedido sin identificador no llega a eso —no
  // hay nota que juzgar—, y por eso `writeError` lo baja a 400.
  assert.equal(respuesta.status, 400);
  assert.equal((await respuesta.json()).code, 'validation');
});

test('un sitio sin clave configurada no acepta borrados', async () => {
  // Sin WIWO_WRITE_TOKEN el endpoint existe pero no es de nadie: es el mismo
  // criterio que publicar, y por eso el manifest anuncia delete en false.
  delete process.env.WIWO_WRITE_TOKEN;
  const { config } = sitio(['nota-publicada']);

  const respuesta = await createArticlesHandlers(config).DELETE({
    request: pedido('nota-publicada'),
  });

  assert.equal(respuesta.status, 405);
  assert.equal((await respuesta.json()).code, 'not_supported');
});
