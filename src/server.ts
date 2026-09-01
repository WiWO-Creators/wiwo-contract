import type { WiwoArticle, WiwoField, WiwoSiteArticle } from './contract.js';
import { errorResponse, isIsoDate, jsonResponse, publicOrigin } from './http.js';
import { resolvePageSize, sliceByCursor } from './pagination.js';
import { parseArticleDraft, validateAgainstFields } from './write.js';
import type { WiwoWriteError } from './write.js';

/**
 * Responsabilidad: el lado servidor del contrato — guardar, leer y aceptar
 * notas, con el mismo comportamiento en todos los sitios.
 * Usado por: cada sitio, en su ruta /api/wiwo/v1/articles.
 * NO hace: no sabe qué campos exige un sitio ni cómo son sus URLs; eso llega por
 *   configuración. Tampoco abre la base: recibe un ejecutor de SQL ya resuelto.
 *
 * Vive acá y no en cada sitio porque es exactamente la parte que NO puede
 * diferir. Con cien sitios copiando este archivo, cada copia envejece a su ritmo
 * y el orquestador termina hablando con cien protocolos parecidos pero
 * distintos: uno que ordena al revés rompe el cursor de paginación, otro que
 * fecha con el reloj de quien publica rompe la sincronización incremental. Lo
 * que cambia por sitio es su formato, no su protocolo.
 */

/**
 * La superficie mínima de base de datos que necesita el contrato.
 *
 * Es un subconjunto de lo que exponen los sitios, a propósito: pedir menos deja
 * que cualquier ejecutor de SQL sirva sin adaptarlo.
 */
export interface WiwoSql {
  query<T = Record<string, unknown>>(text: string, params?: unknown[]): Promise<T[]>;
}

/** Tabla donde cada sitio guarda lo que publicó el orquestador. */
export const WIWO_ARTICLES_TABLE = 'wiwo_articles';

/** Lo que guarda y devuelve un sitio de las notas que le publicaron. */
export interface WiwoArticleStore {
  /** Las notas publicadas, o vacío si la base no está disponible. */
  read(since?: string): Promise<WiwoSiteArticle[]>;
  /** Una nota por su identificador, o null si no está. */
  find(id: string): Promise<WiwoSiteArticle | null>;
  /** Guarda una nota, reemplazándola si ya existía. */
  save(article: WiwoSiteArticle): Promise<void>;
}

/** Lo que devuelve la base: la nota en JSON, ya parseada o todavía en texto. */
type Fila = { article: unknown };

/**
 * Saca la nota de una fila.
 *
 * El driver puede devolver `jsonb` ya parseado o como texto según versión, así
 * que se aceptan las dos formas en vez de confiar en una.
 */
function aArticulo(fila: Fila): WiwoSiteArticle {
  const valor = fila.article;
  return (typeof valor === 'string' ? JSON.parse(valor) : valor) as WiwoSiteArticle;
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
export function createArticleStore(getSql: () => Promise<WiwoSql>): WiwoArticleStore {
  return {
    /**
     * Degrada a vacío a propósito: el archivo del repositorio sigue siendo
     * contenido válido, y hacer fallar el endpoint entero por una base caída
     * dejaría al sitio pareciendo muerto ante el orquestador cuando en realidad
     * tiene notas que servir.
     */
    async read(since?: string): Promise<WiwoSiteArticle[]> {
      try {
        const sql = await getSql();
        const filas = since
          ? await sql.query<Fila>(
              `select article from ${WIWO_ARTICLES_TABLE} where updated_at >= $1 order by published_at desc, id asc`,
              [since],
            )
          : await sql.query<Fila>(
              `select article from ${WIWO_ARTICLES_TABLE} order by published_at desc, id asc`,
            );
        return filas.map(aArticulo);
      } catch (error) {
        console.error('[wiwo] no se pudieron leer las notas publicadas:', error);
        return [];
      }
    },

    async find(id: string): Promise<WiwoSiteArticle | null> {
      const sql = await getSql();
      const filas = await sql.query<Fila>(
        `select article from ${WIWO_ARTICLES_TABLE} where id = $1`,
        [id],
      );
      return filas.length > 0 ? aArticulo(filas[0]) : null;
    },

    /**
     * No degrada ante un fallo: a diferencia de la lectura, una escritura que
     * falla en silencio le haría creer al orquestador que publicó algo que no
     * existe.
     */
    async save(article: WiwoSiteArticle): Promise<void> {
      const sql = await getSql();
      await sql.query(
        `insert into ${WIWO_ARTICLES_TABLE} (id, published_at, updated_at, article)
         values ($1, $2, $3, $4)
         on conflict (id) do update set
           published_at = excluded.published_at,
           updated_at = excluded.updated_at,
           article = excluded.article,
           written_at = now()`,
        [article.id, article.publishedAt, article.updatedAt, JSON.stringify(article)],
      );
    },
  };
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
export function compareArticles(a: WiwoSiteArticle, b: WiwoSiteArticle): number {
  if (a.publishedAt !== b.publishedAt) return a.publishedAt < b.publishedAt ? 1 : -1;
  const rangoA = a.rank ?? Infinity;
  const rangoB = b.rank ?? Infinity;
  if (rangoA !== rangoB) return rangoA - rangoB;
  return a.id.localeCompare(b.id);
}

/**
 * Une el archivo del repositorio con lo publicado por el orquestador.
 *
 * Cuando una nota está en los dos lados gana la de la base: el archivo del
 * repositorio es lo que se publicó originalmente y la base es lo que se corrigió
 * después.
 */
export function mergeArticles(
  archivo: WiwoSiteArticle[],
  publicadas: WiwoSiteArticle[],
): WiwoSiteArticle[] {
  const porId = new Map(archivo.map((article) => [article.id, article]));
  for (const article of publicadas) porId.set(article.id, article);
  return [...porId.values()].sort(compareArticles);
}

/** Lo que un sitio aporta al protocolo: su formato, sus URLs y su almacén. */
export interface WiwoSiteConfig {
  /** Dónde viven las notas que publicó el orquestador. */
  store: WiwoArticleStore;
  /**
   * El archivo editorial del propio repositorio.
   *
   * Ya viene en la forma del contrato: el sitio guarda esa forma, no la suya.
   * No recibe el origen porque no le hace falta — las URLs las resuelve el
   * contrato al salir al cable, y así el archivo es un dato puro.
   *
   * @param since Fecha ISO (AAAA-MM-DD). Solo las CAMBIADAS ese día o después
   *   —publicadas o corregidas—, que es lo que permite que una nota vieja
   *   corregida hoy vuelva a viajar. Ausente = todas.
   */
  archive(since?: string): WiwoSiteArticle[] | Promise<WiwoSiteArticle[]>;
  /** Los campos que el sitio exige para aceptar una nota. */
  fields(origin: string): WiwoField[];
  /** La URL pública de una nota en este sitio. */
  urlFor(id: string, origin: string): string;
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
export function denyWrite(request: Request): WiwoWriteError | null {
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
export function canWrite(): boolean {
  return Boolean(process.env.WIWO_WRITE_TOKEN?.trim());
}

/** Hoy, en AAAA-MM-DD. Es el reloj del SITIO, no el de quien publica. */
function hoy(): string {
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
function writeError(error: WiwoWriteError): Response {
  const status =
    error.code === 'unauthorized'
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
export async function allArticles(
  config: WiwoSiteConfig,
  origin: string,
  since?: string,
): Promise<WiwoArticle[]> {
  const [archivo, publicadas] = await Promise.all([
    config.archive(since),
    config.store.read(since),
  ]);
  return mergeArticles(archivo, publicadas).map((article) =>
    alCable(article, origin, config.urlFor),
  );
}

/**
 * Resuelve lo que depende del dominio por el que preguntaron.
 *
 * Un sitio guarda su imagen como ruta propia —`/fotos/portada.jpg`— porque es
 * así como la sirve. Al cable tiene que salir absoluta, o el orquestador la
 * pediría contra su propio dominio y no la encontraría. Una URL que ya venga
 * absoluta se deja igual, así que aplicarlo dos veces no rompe nada.
 */
function alCable(
  article: WiwoSiteArticle,
  origin: string,
  urlFor: WiwoSiteConfig['urlFor'],
): WiwoArticle {
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
export function createArticlesHandlers(config: WiwoSiteConfig): {
  GET(ctx: { request: Request }): Promise<Response>;
  POST(ctx: { request: Request }): Promise<Response>;
} {
  return {
    async GET({ request }) {
      const params = new URL(request.url).searchParams;
      const since = params.get('since');

      if (since !== null && !isIsoDate(since)) {
        return errorResponse(
          `El parámetro "since" debe ser una fecha AAAA-MM-DD; llegó "${since}"`,
          400,
        );
      }

      const origin = publicOrigin(request);
      const todas = await allArticles(config, origin, since ?? undefined);

      const { items, nextCursor } = sliceByCursor(
        todas,
        (article) => article.id,
        resolvePageSize(params.get('limit')),
        params.get('cursor'),
      );

      return jsonResponse({
        articles: items,
        count: items.length,
        nextCursor,
        generatedAt: new Date().toISOString(),
      });
    },

    async POST({ request }) {
      const negado = denyWrite(request);
      if (negado) return writeError(negado);

      let cuerpo: unknown;
      try {
        cuerpo = await request.json();
      } catch {
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

      const article: WiwoSiteArticle = {
        ...draft,
        id,
        // Las dos fechas las pone el sitio. Si las pusiera quien publica, dos
        // relojes desfasados romperían la sincronización incremental, que es
        // justo lo que `updatedAt` existe para sostener.
        publishedAt: previa?.publishedAt ?? draft.publishedAt ?? hoy(),
        updatedAt: hoy(),
      };

      await config.store.save(article);

      return jsonResponse(
        {
          id: article.id,
          url: config.urlFor(article.id, origin),
          updatedAt: article.updatedAt,
        },
        previa ? 200 : 201,
      );
    },
  };
}
