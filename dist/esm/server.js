import { errorResponse, isIsoDate, jsonResponse, publicOrigin } from './http.js';
import { resolvePageSize, sliceByCursor } from './pagination.js';
import { parseArticleDraft, validateAgainstFields } from './write.js';
import { WIWO_MEDIA_TABLE, mediaContentType, parseMediaUpload, } from './media.js';
/** Tabla donde cada sitio guarda lo que publicó el orquestador. */
export const WIWO_ARTICLES_TABLE = 'wiwo_articles';
/**
 * Saca la nota de una fila.
 *
 * El driver puede devolver `jsonb` ya parseado o como texto según versión, así
 * que se aceptan las dos formas en vez de confiar en una.
 */
function aArticulo(fila) {
    const valor = fila.article;
    return (typeof valor === 'string' ? JSON.parse(valor) : valor);
}
/**
 * El almacén de notas publicadas de un sitio.
 *
 * La nota se guarda en la forma del CONTRATO, no en el modelo interno del sitio.
 * Traducirla de ida y vuelta pediría un adaptador inverso completo, y cada campo
 * que ese adaptador no cubriera se perdería en silencio al editar una nota ya
 * publicada.
 *
 * @param getSql Cómo obtener el ejecutor de SQL del sitio. Se pide como función
 *   y no como valor porque abrir la base es asíncrono y solo ocurre en el
 *   servidor.
 */
export function createArticleStore(getSql) {
    return {
        /**
         * Degrada a vacío a propósito: el archivo del repositorio sigue siendo
         * contenido válido, y hacer fallar el endpoint entero por una base caída
         * dejaría al sitio pareciendo muerto ante el orquestador cuando en realidad
         * tiene notas que servir.
         */
        async read(since) {
            try {
                const sql = await getSql();
                const filas = since
                    ? await sql.query(`select article from ${WIWO_ARTICLES_TABLE} where updated_at >= $1 order by published_at desc, id asc`, [since])
                    : await sql.query(`select article from ${WIWO_ARTICLES_TABLE} order by published_at desc, id asc`);
                return filas.map(aArticulo);
            }
            catch (error) {
                console.error('[wiwo] no se pudieron leer las notas publicadas:', error);
                return [];
            }
        },
        async find(id) {
            const sql = await getSql();
            const filas = await sql.query(`select article from ${WIWO_ARTICLES_TABLE} where id = $1`, [id]);
            return filas.length > 0 ? aArticulo(filas[0]) : null;
        },
        /**
         * No degrada ante un fallo: a diferencia de la lectura, una escritura que
         * falla en silencio le haría creer al orquestador que publicó algo que no
         * existe.
         */
        async save(article) {
            const sql = await getSql();
            await sql.query(`insert into ${WIWO_ARTICLES_TABLE} (id, published_at, updated_at, article)
         values ($1, $2, $3, $4)
         on conflict (id) do update set
           published_at = excluded.published_at,
           updated_at = excluded.updated_at,
           article = excluded.article,
           written_at = now()`, [article.id, article.publishedAt, article.updatedAt, JSON.stringify(article)]);
        },
    };
}
/**
 * El almacén de archivos de un sitio, sobre su propia base.
 *
 * Los bytes van en la misma base que las notas y no en el disco: los sitios
 * corren en plataformas donde el sistema de archivos es de solo lectura, así que
 * un archivo escrito en disco desaparece en el despliegue siguiente. La base es
 * lo único que ya tienen todos y que sobrevive.
 *
 * @param getSql Cómo obtener el ejecutor de SQL del sitio. Se recibe como
 *   función porque abrir la base es asíncrono y no debe pasar al importar.
 */
export function createMediaStore(getSql) {
    return {
        /**
         * No degrada ante un fallo, igual que guardar una nota: si esto fallara en
         * silencio, el orquestador publicaría la nota apuntando a una imagen que
         * nunca se guardó.
         */
        async save(file) {
            const sql = await getSql();
            // El identificador es el hash del contenido, así que un choque significa
            // que el archivo YA está guardado y es idéntico: no hay nada que escribir.
            await sql.query(`insert into ${WIWO_MEDIA_TABLE} (id, content_type, bytes, data)
         values ($1, $2, $3, $4)
         on conflict (id) do nothing`, [file.id, file.contentType, file.bytes, Buffer.from(file.data)]);
        },
        async find(id) {
            const sql = await getSql();
            const filas = await sql.query(`select content_type, data from ${WIWO_MEDIA_TABLE} where id = $1`, [id]);
            if (filas.length === 0)
                return null;
            return {
                contentType: filas[0].content_type,
                data: aBytes(filas[0].data),
            };
        },
    };
}
/**
 * Los bytes de una columna binaria.
 *
 * Según el driver, `bytea` vuelve como Buffer, como Uint8Array o como el texto
 * hexadecimal que usa Postgres (`\x…`). Se aceptan las tres en vez de confiar en
 * una: el sitio elige su driver y el contrato no debería obligarlo a cambiarlo.
 */
function aBytes(valor) {
    if (valor instanceof Uint8Array)
        return valor;
    if (typeof valor === 'string' && valor.startsWith('\\x')) {
        const hex = valor.slice(2);
        const bytes = new Uint8Array(hex.length / 2);
        for (let i = 0; i < bytes.length; i += 1) {
            bytes[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16);
        }
        return bytes;
    }
    throw new Error('[wiwo] la base devolvió el archivo en un formato inesperado');
}
/**
 * El orden en que las notas salen al cable.
 *
 * De la más nueva a la más vieja; dentro del mismo día manda `rank` —la
 * curaduría de portada del sitio— y, si tampoco desempata, el identificador.
 * Tiene que ser total y estable entre pedidos o el cursor de paginación deja de
 * significar algo: dos notas que cambian de posición entre dos páginas se
 * repiten o se pierden.
 */
export function compareArticles(a, b) {
    if (a.publishedAt !== b.publishedAt)
        return a.publishedAt < b.publishedAt ? 1 : -1;
    const rangoA = a.rank ?? Infinity;
    const rangoB = b.rank ?? Infinity;
    if (rangoA !== rangoB)
        return rangoA - rangoB;
    return a.id.localeCompare(b.id);
}
/**
 * Une el archivo del repositorio con lo publicado por el orquestador.
 *
 * Cuando una nota está en los dos lados gana la de la base: el archivo del
 * repositorio es lo que se publicó originalmente y la base es lo que se corrigió
 * después.
 */
export function mergeArticles(archivo, publicadas) {
    const porId = new Map(archivo.map((article) => [article.id, article]));
    for (const article of publicadas)
        porId.set(article.id, article);
    return [...porId.values()].sort(compareArticles);
}
/**
 * Comprueba que quien escribe sea el orquestador.
 *
 * Dos capas, no una. La clave sola basta para el uso normal, pero con cien
 * sitios repartiendo la misma clase de credencial, una filtrada se usa desde
 * cualquier parte; el orquestador sale siempre desde la misma IP, así que
 * acotarlo cuesta una variable y cierra ese caso.
 *
 * Lee `WIWO_WRITE_TOKEN` y, opcionalmente, `WIWO_WRITE_IPS` del entorno del
 * sitio. Sin la primera el sitio no acepta publicaciones; sin la segunda, la
 * clave es la única puerta.
 *
 * @returns Null si puede escribir, o el error que corresponde.
 */
export function denyWrite(request) {
    const esperada = process.env.WIWO_WRITE_TOKEN?.trim();
    if (!esperada) {
        return {
            code: 'not_supported',
            message: 'Este sitio no tiene configurada la publicación remota.',
        };
    }
    if (request.headers.get('authorization') !== `Bearer ${esperada}`) {
        return { code: 'unauthorized', message: 'Clave ausente o incorrecta.' };
    }
    const permitidas = process.env.WIWO_WRITE_IPS?.trim();
    if (permitidas) {
        const origen = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
        const lista = permitidas.split(',').map((ip) => ip.trim());
        if (!origen || !lista.includes(origen)) {
            return { code: 'unauthorized', message: 'Origen no autorizado.' };
        }
    }
    return null;
}
/**
 * True si el sitio tiene configurada la clave de publicación.
 *
 * Es lo que el manifest anuncia como `capabilities.write`: sin clave el endpoint
 * existe pero rechaza todo, así que anunciarlo haría que el orquestador
 * ofreciera un destino que no puede recibir nada.
 */
export function canWrite() {
    return Boolean(process.env.WIWO_WRITE_TOKEN?.trim());
}
/** Hoy, en AAAA-MM-DD. Es el reloj del SITIO, no el de quien publica. */
function hoy() {
    return new Date().toISOString().slice(0, 10);
}
/**
 * Error de escritura, con el código HTTP que le corresponde.
 *
 * Una nota que no cumple lo que el sitio pide se responde 422 y no 400: el
 * cuerpo se entendió bien, lo que falla son sus datos. El 400 queda para lo que
 * ni siquiera se pudo leer. La diferencia importa del otro lado: con 422 el
 * orquestador sabe que puede señalar campo por campo y dejar el formulario
 * abierto, y con 400 que no hay nada que señalar.
 */
function writeError(error) {
    const status = error.code === 'unauthorized'
        ? 401
        : error.code === 'not_supported'
            ? 405
            : error.code === 'not_found'
                ? 404
                : error.code === 'conflict'
                    ? 409
                    : error.fields
                        ? 422
                        : 400;
    return jsonResponse(error, status);
}
/**
 * Todas las notas que el sitio publica al cable: las del repositorio MÁS las que
 * publicó el orquestador, unidas y ordenadas.
 */
export async function allArticles(config, origin, since) {
    const [archivo, publicadas] = await Promise.all([
        config.archive(since),
        config.store.read(since),
    ]);
    return mergeArticles(archivo, publicadas).map((article) => alCable(article, origin, config.urlFor));
}
/**
 * Resuelve lo que depende del dominio por el que preguntaron.
 *
 * Un sitio guarda su imagen como ruta propia —`/fotos/portada.jpg`— porque es
 * así como la sirve. Al cable tiene que salir absoluta, o el orquestador la
 * pediría contra su propio dominio y no la encontraría. Una URL que ya venga
 * absoluta se deja igual, así que aplicarlo dos veces no rompe nada.
 */
function alCable(article, origin, urlFor) {
    return {
        ...article,
        url: urlFor(article.id, origin),
        image: article.image
            ? { ...article.image, url: new URL(article.image.url, origin).toString() }
            : null,
    };
}
/**
 * Los manejadores HTTP del contrato para un sitio.
 *
 * Devuelve la nota entera, cuerpo incluido, y por eso pagina: una nota pesa unos
 * 12 KB, así que un archivo grande sin paginar supera el tamaño que el
 * orquestador acepta y quedaría descartado ENTERO, no truncado.
 *
 * @param config Lo propio del sitio: su almacén, su archivo, sus campos y sus
 *   URLs.
 */
/**
 * True si este sitio puede recibir archivos.
 *
 * Es lo que el manifest anuncia como `capabilities.media`: hacen falta las dos
 * cosas, un lugar donde guardarlos y la clave de escritura, porque subir un
 * archivo es escribir. Anunciarlo sin alguna de las dos haría que el orquestador
 * ofreciera subir a un destino que va a rechazar todo.
 */
export function canWriteMedia(config) {
    return config.media !== undefined && canWrite();
}
/**
 * El endpoint que RECIBE archivos: POST /api/wiwo/v1/media.
 *
 * Pide la misma clave que publicar una nota, y por el mismo motivo: subir un
 * archivo escribe en el sitio, y sin clave cualquiera podría llenarle la base de
 * imágenes ajenas.
 *
 * Contesta 201 con la URL pública, que es lo único que le sirve a quien sube: se
 * pega tal cual en el campo de imagen de la nota.
 */
export function createMediaHandlers(config) {
    return {
        async POST({ request }) {
            if (!config.media) {
                return writeError({
                    code: 'not_supported',
                    message: 'Este sitio no acepta archivos.',
                });
            }
            const negado = denyWrite(request);
            if (negado)
                return writeError(negado);
            const archivo = await parseMediaUpload(request);
            if ('code' in archivo)
                return writeError(archivo);
            await config.media.store.save(archivo);
            return jsonResponse({
                url: config.media.urlFor(archivo.id, publicOrigin(request)),
                id: archivo.id,
                contentType: archivo.contentType,
                bytes: archivo.bytes,
            }, 201);
        },
    };
}
/**
 * El endpoint que SIRVE archivos: GET /api/wiwo/v1/media/:id.
 *
 * Es público, como el resto de lo que el sitio publica: la imagen de una nota la
 * ve cualquiera que lea la nota, y pedir clave para verla rompería la página.
 *
 * Se cachea para siempre porque el identificador es el hash del contenido: esa
 * URL no puede pasar a significar otra imagen, así que revalidarla no cambiaría
 * nunca nada.
 */
export function createMediaFileHandlers(config) {
    return {
        async GET({ params }) {
            if (!config.media)
                return errorResponse('Este sitio no sirve archivos.', 404);
            // Se valida la extensión antes de tocar la base: el identificador viaja en
            // la URL, y sin esto cualquier cadena llegaría a la consulta.
            if (!mediaContentType(params.id)) {
                return errorResponse('Ese archivo no existe.', 404);
            }
            const archivo = await config.media.store.find(params.id);
            if (!archivo)
                return errorResponse('Ese archivo no existe.', 404);
            return new Response(archivo.data, {
                headers: {
                    'content-type': archivo.contentType,
                    'content-length': String(archivo.data.byteLength),
                    'cache-control': 'public, max-age=31536000, immutable',
                    'access-control-allow-origin': '*',
                },
            });
        },
    };
}
export function createArticlesHandlers(config) {
    return {
        async GET({ request }) {
            const params = new URL(request.url).searchParams;
            const since = params.get('since');
            if (since !== null && !isIsoDate(since)) {
                return errorResponse(`El parámetro "since" debe ser una fecha AAAA-MM-DD; llegó "${since}"`, 400);
            }
            const origin = publicOrigin(request);
            const todas = await allArticles(config, origin, since ?? undefined);
            const { items, nextCursor } = sliceByCursor(todas, (article) => article.id, resolvePageSize(params.get('limit')), params.get('cursor'));
            return jsonResponse({
                articles: items,
                count: items.length,
                nextCursor,
                generatedAt: new Date().toISOString(),
            });
        },
        async POST({ request }) {
            const negado = denyWrite(request);
            if (negado)
                return writeError(negado);
            let cuerpo;
            try {
                cuerpo = await request.json();
            }
            catch {
                return writeError({ code: 'validation', message: 'El cuerpo no es JSON.' });
            }
            const draft = parseArticleDraft(cuerpo);
            if (!draft) {
                return writeError({
                    code: 'validation',
                    message: 'Falta el título o el cuerpo de la nota.',
                });
            }
            const origin = publicOrigin(request);
            const errores = validateAgainstFields(draft, config.fields(origin));
            if (Object.keys(errores).length > 0) {
                return writeError({
                    code: 'validation',
                    message: 'La nota no cumple lo que pide el sitio.',
                    fields: errores,
                });
            }
            // El identificador lo propone el orquestador pero lo fija el sitio: sin
            // uno, no hay a qué volver para corregir la nota más tarde.
            const id = draft.id?.trim();
            if (!id) {
                return writeError({
                    code: 'validation',
                    message: 'Falta el identificador de la nota.',
                });
            }
            const previa = await config.store.find(id);
            const article = {
                ...draft,
                id,
                // Las dos fechas las pone el sitio. Si las pusiera quien publica, dos
                // relojes desfasados romperían la sincronización incremental, que es
                // justo lo que `updatedAt` existe para sostener.
                publishedAt: previa?.publishedAt ?? draft.publishedAt ?? hoy(),
                updatedAt: hoy(),
            };
            await config.store.save(article);
            return jsonResponse({
                id: article.id,
                url: config.urlFor(article.id, origin),
                updatedAt: article.updatedAt,
            }, previa ? 200 : 201);
        },
    };
}
