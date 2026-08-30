import {
  isSupportedContract,
  type WiwoArticle,
  type WiwoArticlePage,
  type WiwoBody,
  type WiwoBlock,
  type WiwoManifest,
} from './contract.js';

/**
 * Responsabilidad: reconocer y normalizar lo que devuelve un sitio.
 * Usado por: wiwo.doom, al leer una página conectada.
 * NO hace: no consulta la red; opera sobre un valor ya parseado desde JSON.
 *
 * Por qué la validación es tan terca: un SPA con ruta comodín responde 200 y
 * HTML a CUALQUIER dirección, incluida una que no existe. Está comprobado
 * contra un sitio real. Confiar en el código de estado daría por bueno un 404
 * disfrazado, así que una respuesta solo se acepta si además parsea como JSON y
 * trae los campos del contrato.
 *
 * Todo lo que falta se completa con valores neutros en vez de rechazar la nota:
 * un sitio sin secciones, sin firma o sin imagen es válido, no roto.
 */

/** True si el valor es un objeto plano al que se le pueden leer campos. */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Convierte a texto solo lo que razonablemente es texto.
 *
 * No se usa String() directo porque un sitio que mandara un objeto donde va una
 * cadena dejaría guardado el literal "[object Object]", que además se vería tal
 * cual en la interfaz.
 */
function asText(value: unknown): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return '';
}

/**
 * Reconoce un manifest.
 *
 * Solo exige lo que el orquestador necesita para decidir: la versión y las
 * capacidades. El resto se usa tal como venga, porque un sitio puede declarar
 * campos que este lector todavía no conoce y eso no es un error.
 *
 * @returns El manifest, o null si el valor no lo es.
 */
export function parseManifest(value: unknown): WiwoManifest | null {
  if (!isRecord(value)) return null;
  if (typeof value.contract !== 'string') return null;
  if (!isRecord(value.capabilities)) return null;
  if (!isRecord(value.format)) return null;
  if (!Array.isArray(value.format.fields)) return null;

  return value as unknown as WiwoManifest;
}

/** Motivo por el que un manifest no sirve, o null si sirve. */
export function describeManifestProblem(
  manifest: WiwoManifest,
): string | null {
  if (!isSupportedContract(manifest.contract)) {
    return `El sitio habla el contrato ${manifest.contract}, que este orquestador todavía no sabe leer`;
  }
  if (!manifest.capabilities?.articles) {
    return 'La página no publica artículos';
  }
  if (!manifest.capabilities?.read) {
    return 'La página no permite leer su contenido';
  }
  return null;
}

/**
 * Reconoce una página del listado.
 *
 * Descarta las notas sin id o sin título en vez de rechazar la respuesta
 * entera: una fila rota en el origen no debe esconder a las demás.
 *
 * @returns La página, o null si la respuesta no tiene forma de listado.
 */
export function parseArticlePage(value: unknown): WiwoArticlePage | null {
  if (!isRecord(value) || !Array.isArray(value.articles)) return null;

  const articles = value.articles
    .filter(
      (article): article is Record<string, unknown> =>
        isRecord(article) &&
        typeof article.id === 'string' &&
        article.id.length > 0 &&
        typeof article.title === 'string',
    )
    .map(normalizeArticle);

  return {
    articles,
    count: articles.length,
    // Un sitio 1.0 no pagina: sin cursor, el lector se queda con lo que vino.
    nextCursor:
      typeof value.nextCursor === 'string' && value.nextCursor.length > 0
        ? value.nextCursor
        : null,
    generatedAt:
      typeof value.generatedAt === 'string'
        ? value.generatedAt
        : new Date().toISOString(),
  };
}

/** Completa una nota con valores neutros donde el sitio no informó nada. */
function normalizeArticle(raw: Record<string, unknown>): WiwoArticle {
  const seo = isRecord(raw.seo) ? raw.seo : {};
  const publishedAt = typeof raw.publishedAt === 'string' ? raw.publishedAt : '';

  return {
    id: raw.id as string,
    url: typeof raw.url === 'string' ? raw.url : '',
    title: raw.title as string,
    summary: typeof raw.summary === 'string' ? raw.summary : '',
    section: isRecord(raw.section)
      ? {
          id: asText(raw.section.id),
          label: asText(raw.section.label) || asText(raw.section.id),
        }
      : null,
    author: isRecord(raw.author)
      ? {
          name: asText(raw.author.name),
          ...(typeof raw.author.slug === 'string'
            ? { slug: raw.author.slug }
            : {}),
          ...(typeof raw.author.role === 'string'
            ? { role: raw.author.role }
            : {}),
        }
      : null,
    publishedAt,
    // Un sitio 1.0 no informa updatedAt: se cae a la publicación, que es lo que
    // esos sitios hacían igual.
    updatedAt: typeof raw.updatedAt === 'string' ? raw.updatedAt : publishedAt,
    readingMinutes:
      typeof raw.readingMinutes === 'number' ? raw.readingMinutes : null,
    image: isRecord(raw.image)
      ? { url: asText(raw.image.url), alt: asText(raw.image.alt) }
      : null,
    tags: Array.isArray(raw.tags) ? raw.tags.map(asText).filter(Boolean) : [],
    featured: raw.featured === true,
    rank: typeof raw.rank === 'number' ? raw.rank : null,
    body: normalizeBody(raw.body),
    seo: {
      title: typeof seo.title === 'string' ? seo.title : null,
      description: typeof seo.description === 'string' ? seo.description : null,
      tldr: Array.isArray(seo.tldr) ? seo.tldr.map(asText).filter(Boolean) : [],
      faq: Array.isArray(seo.faq)
        ? seo.faq.filter(isRecord).map((par) => ({
            question: asText(par.question),
            answer: asText(par.answer),
          }))
        : [],
    },
    extra: isRecord(raw.extra) ? raw.extra : {},
  };
}

/**
 * Normaliza el cuerpo a una de las dos formas del contrato.
 *
 * Un cuerpo ausente o irreconocible se lee como Markdown vacío en vez de
 * fallar: una nota sin cuerpo legible sigue siendo listable, y perderla entera
 * por eso sería peor.
 */
function normalizeBody(value: unknown): WiwoBody {
  if (isRecord(value)) {
    if (value.format === 'markdown' && typeof value.markdown === 'string') {
      return { format: 'markdown', markdown: value.markdown };
    }
    if (value.format === 'blocks' && Array.isArray(value.blocks)) {
      return {
        format: 'blocks',
        blocks: value.blocks
          .filter(isRecord)
          .filter((block) => typeof block.type === 'string') as WiwoBlock[],
      };
    }
  }

  return { format: 'markdown', markdown: '' };
}
