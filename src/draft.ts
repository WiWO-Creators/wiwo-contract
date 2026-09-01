import type { WiwoBody, WiwoField } from './contract.js';
import { parseMarkdownBlocks } from './blocks.js';
import { CORE_FIELD_KEYS, type WiwoArticleDraft } from './write.js';

/**
 * Responsabilidad: armar un borrador del contrato a partir de lo que se escribió
 * en un formulario descrito por el manifest de un sitio.
 * Usado por: el orquestador (wiwo.doom), al publicar.
 * NO hace: no valida —eso es validateAgainstFields— ni envía.
 *
 * Vive en el paquete, y no en el orquestador, porque es la INVERSA exacta de la
 * tabla con que el sitio valida (EN_EL_NUCLEO, en write.ts). Separadas, la
 * primera divergencia no se ve: el orquestador arma un borrador que cree
 * completo, el sitio lo juzga mirando otro lugar y contesta que falta un campo
 * que sí se escribió. Juntas, cambiar una obliga a mirar la otra.
 */

/**
 * Valor de un campo mientras se edita.
 *
 * Todo llega como texto salvo las listas, porque los controles de un formulario
 * devuelven texto. La conversión al tipo final ocurre acá, al enviar.
 */
export type WiwoFieldValue = string | string[] | { key: string; value: string }[];

/** Lo escrito en el formulario, por clave de campo. */
export type WiwoFieldValues = Record<string, WiwoFieldValue | undefined>;

/** Lo que hace falta además de los campos del formulario. */
export interface WiwoDraftContext {
  /** Fecha de publicación propuesta, AAAA-MM-DD. El sitio puede reemplazarla. */
  publishedAt: string;
  /**
   * Identificador de una nota que ya existe, para corregirla en vez de crear
   * otra. Ausente: se propone uno a partir del título.
   */
  id?: string;
}

/** El texto de un campo, o cadena vacía si no es texto. */
function texto(valor: WiwoFieldValue | undefined): string {
  return typeof valor === 'string' ? valor.trim() : '';
}

/** La lista de un campo, venga ya como lista o como texto separado por comas. */
function lista(valor: WiwoFieldValue | undefined): string[] {
  if (Array.isArray(valor)) {
    return valor
      .map((v) => (typeof v === 'string' ? v : v.value))
      .filter((v) => v.trim() !== '');
  }
  return texto(valor)
    .split(',')
    .map((parte) => parte.trim())
    .filter(Boolean);
}

/** Los pares clave/valor de un campo, o vacío si no los hay. */
function pares(valor: WiwoFieldValue | undefined): { key: string; value: string }[] {
  if (!Array.isArray(valor)) return [];
  return valor
    .filter((v): v is { key: string; value: string } => typeof v !== 'string')
    .filter((par) => par.key.trim() !== '' && par.value.trim() !== '');
}

/** El número de un campo, o null si no hay nada que interpretar. */
function numero(valor: WiwoFieldValue | undefined): number | null {
  const crudo = texto(valor);
  if (!crudo) return null;
  const n = Number(crudo);
  return Number.isFinite(n) ? n : null;
}

/**
 * Identificador a partir del título.
 *
 * Solo se PROPONE: el sitio decide el definitivo. Se quitan los acentos porque
 * la nota termina en una URL, y "políticas" y "politicas" no deben ser dos
 * direcciones distintas.
 */
export function proposeId(title: string): string {
  return title
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

/**
 * La etiqueta visible de un valor de lista cerrada.
 *
 * En un campo `enum` el valor es la IDENTIDAD —el identificador de la sección,
 * el slug del autor— y la etiqueta es cómo se muestra. Guardar la etiqueta como
 * identidad haría que renombrar una sección desconectara sus notas.
 */
function etiquetaDe(campo: WiwoField | undefined, valor: string): string {
  return campo?.options?.find((option) => option.value === valor)?.label ?? valor;
}

/**
 * El cuerpo, en la forma que el sitio declaró que acepta.
 *
 * Un sitio que pide bloques no sabe mostrar Markdown: su plantilla recorre el
 * cuerpo bloque a bloque. Mandarle una cadena lo dejaría guardando una nota que
 * no puede dibujar, sin ningún error.
 */
function cuerpoPara(campo: WiwoField | undefined, escrito: string): WiwoBody {
  return campo?.type === 'blocks'
    ? { format: 'blocks', blocks: parseMarkdownBlocks(escrito) }
    : { format: 'markdown', markdown: escrito };
}

/**
 * Arma el borrador para el contrato.
 *
 * El núcleo se rellena a mano —cada campo tiene su lugar en la estructura— y
 * todo lo que el sitio declara y el núcleo no cubre va a `extra`. Sin esa
 * separación, la sección y la firma caerían también en `extra` y el sitio
 * guardaría una nota que se ve bien al publicarla y aparece sin sección ni firma
 * al leerla.
 *
 * @param fields Los campos que declara el sitio en su manifest.
 * @param values Lo escrito en el formulario, por clave de campo.
 * @param context Lo que el formulario no pregunta.
 */
export function buildArticleDraft(
  fields: WiwoField[],
  values: WiwoFieldValues,
  context: WiwoDraftContext,
): WiwoArticleDraft {
  const porClave = new Map(fields.map((campo) => [campo.key, campo]));
  const v = (clave: string) => values[clave];

  const title = texto(v('title'));
  const seccion = texto(v('section'));
  const firma = texto(v('author'));
  const campoAutor = porClave.get('author');

  const delNucleo = new Set(CORE_FIELD_KEYS);
  const extra = Object.fromEntries(
    fields
      .filter((campo) => !delNucleo.has(campo.key))
      .map((campo) => [campo.key, values[campo.key]])
      .filter(([, valor]) => {
        if (typeof valor === 'string') return valor.trim() !== '';
        return Array.isArray(valor) && valor.length > 0;
      }),
  );

  return {
    id: context.id ?? proposeId(title),
    title,
    summary: texto(v('summary')),
    section: { id: seccion, label: etiquetaDe(porClave.get('section'), seccion) },
    // Un sitio que elige autor de una lista cerrada identifica por slug; uno que
    // firma con una línea editorial solo tiene el nombre. Se emiten los dos para
    // que el sitio reconozca al suyo sin que el orquestador sepa cuál usa.
    author:
      campoAutor?.type === 'enum'
        ? { name: etiquetaDe(campoAutor, firma), slug: firma }
        : { name: firma },
    publishedAt: context.publishedAt,
    readingMinutes: numero(v('readingMinutes')) ?? 0,
    image: { url: texto(v('image')), alt: texto(v('imageAlt')) },
    tags: lista(v('tags')),
    featured: texto(v('featured')) === 'true',
    // El sitio ordena por fecha; el orden fino dentro del día es curaduría suya.
    rank: null,
    body: cuerpoPara(porClave.get('body'), texto(v('body'))),
    seo: {
      title: texto(v('seoTitle')) || null,
      description: texto(v('seoDescription')) || null,
      tldr: lista(v('tldr')),
      faq: pares(v('faq')).map(({ key, value }) => ({ question: key, answer: value })),
    },
    extra,
  };
}
