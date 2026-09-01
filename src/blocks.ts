import type { WiwoBlock, WiwoBlockType } from './contract.js';

/**
 * Responsabilidad: el vocabulario de bloques que todos los sitios comparten, y
 * cómo se llega a él desde Markdown.
 * Usado por: los sitios (para declararlo y dibujarlo) y el orquestador (para
 *   armar un cuerpo a partir de lo que se escribe).
 * NO hace: no dibuja. Cómo se ve un párrafo es asunto de cada sitio.
 *
 * Existe porque el cuerpo es lo único del contrato con estructura interna, y sin
 * un vocabulario común cada sitio inventa el suyo —uno llama `p` al párrafo y
 * otro `paragraph`, uno `q` a la cita y otro `pullquote`— y el orquestador
 * termina necesitando una tabla de traducción por sitio. Con cien, eso no se
 * sostiene.
 *
 * El vocabulario común es corto a propósito: son las seis formas que aparecen en
 * cualquier texto largo. Lo que un sitio tiene de propio —una cifra destacada,
 * un gráfico, una ficha numerada— sigue siendo suyo, se declara en su manifest y
 * el contrato lo transporta sin entenderlo. Eso es lo que separa el fondo, que
 * es igual, de la forma, que no.
 */

/** Un párrafo de prosa. Admite Markdown en línea: negrita, cursiva, enlace. */
export type WiwoParagraph = { type: 'paragraph'; text: string };
/** Un subtítulo dentro del cuerpo. */
export type WiwoHeading = { type: 'heading'; text: string };
/** Una cita destacada. */
export type WiwoQuote = { type: 'quote'; text: string };
/** Una lista, numerada o no. */
export type WiwoList = { type: 'list'; ordered: boolean; items: string[] };
/** Una tabla con encabezado. */
export type WiwoTable = { type: 'table'; head: string[]; rows: string[][] };
/** Un corte visual entre dos partes del texto. */
export type WiwoDivider = { type: 'divider' };

/** Los bloques que cualquier sitio wiwo entiende. */
export type WiwoCommonBlock =
  | WiwoParagraph
  | WiwoHeading
  | WiwoQuote
  | WiwoList
  | WiwoTable
  | WiwoDivider;

/**
 * Los tipos comunes, para que el manifest de cada sitio los declare sin
 * copiarlos.
 *
 * Se declaran aunque sean comunes: el orquestador arma el editor a partir del
 * manifest, y un sitio que no dibuje tablas no debe ofrecerlas. Un sitio los
 * incluye con `...WIWO_COMMON_BLOCK_TYPES` y añade los suyos detrás.
 */
export const WIWO_COMMON_BLOCK_TYPES: WiwoBlockType[] = [
  { type: 'paragraph', label: 'Párrafo' },
  { type: 'heading', label: 'Subtítulo' },
  { type: 'quote', label: 'Cita destacada' },
  { type: 'list', label: 'Lista' },
  { type: 'table', label: 'Tabla' },
  { type: 'divider', label: 'Separador' },
];

/** True si el bloque es de una fila de tabla en Markdown. */
function esTabla(bloque: string): boolean {
  const lineas = bloque.trim().split('\n');
  return lineas.length >= 2 && lineas[0].includes('|') && lineas[1].includes('---');
}

/** Parte una fila de tabla en celdas. */
function celdas(linea: string): string[] {
  return linea
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((c) => c.trim());
}

/** Convierte un bloque de tabla en su forma estructurada. */
function aTabla(bloque: string): WiwoTable {
  const filas = bloque
    .trim()
    .split('\n')
    .filter((l) => l.trim() && !/^\|?\s*-+\s*\|/.test(l))
    .map(celdas);
  const [head = [], ...rows] = filas;
  return { type: 'table', head, rows };
}

/** Convierte un bloque de lista en su forma estructurada. */
function aLista(bloque: string): WiwoList {
  return {
    type: 'list',
    ordered: /^\d+\.\s/.test(bloque.trim()),
    items: bloque
      .trim()
      .split('\n')
      .map((l) => l.replace(/^\s*(?:[-*]|\d+\.)\s+/, '')),
  };
}

/**
 * Convierte Markdown al vocabulario común de bloques.
 *
 * Se parte por línea en blanco, que es como se separa un párrafo al escribir, y
 * cada trozo se reconoce por cómo empieza. Es deliberadamente el mismo criterio
 * con que un sitio dibujaba su Markdown: convertir no debe cambiar lo que se ve.
 *
 * El Markdown EN LÍNEA —negrita, cursiva, enlaces— se deja intacto dentro del
 * texto. Sacarlo a su propia estructura obligaría a cada sitio a recomponerlo
 * para dibujarlo, y es justo lo que un editor de texto produce sin pensar.
 *
 * @param markdown El cuerpo escrito.
 * @returns Los bloques, en orden. Vacío si no hay nada que convertir.
 */
export function parseMarkdownBlocks(markdown: string): WiwoBlock[] {
  return markdown
    .trim()
    .split(/\n{2,}/)
    .map((bloque) => bloque.trim())
    .filter(Boolean)
    .map((bloque): WiwoBlock => {
      if (bloque === '---') return { type: 'divider' };
      if (esTabla(bloque)) return aTabla(bloque);

      const encabezado = bloque.match(/^#{1,6}\s+(.*)$/s);
      if (encabezado) return { type: 'heading', text: encabezado[1].trim() };

      if (bloque.startsWith('>')) {
        return {
          type: 'quote',
          // Las líneas de una cita se unen con espacio, no con salto: en el
          // original son un solo párrafo cortado a lo ancho de la pantalla.
          text: bloque
            .split('\n')
            .map((linea) => linea.replace(/^>\s?/, ''))
            .join(' ')
            .trim(),
        };
      }

      if (/^[-*]\s/.test(bloque) || /^\d+\.\s/.test(bloque)) return aLista(bloque);

      return { type: 'paragraph', text: bloque.replace(/\n/g, ' ') };
    });
}
