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
export type WiwoParagraph = {
    type: 'paragraph';
    text: string;
};
/** Un subtítulo dentro del cuerpo. */
export type WiwoHeading = {
    type: 'heading';
    text: string;
};
/** Una cita destacada. */
export type WiwoQuote = {
    type: 'quote';
    text: string;
};
/** Una lista, numerada o no. */
export type WiwoList = {
    type: 'list';
    ordered: boolean;
    items: string[];
};
/** Una tabla con encabezado. */
export type WiwoTable = {
    type: 'table';
    head: string[];
    rows: string[][];
};
/** Un corte visual entre dos partes del texto. */
export type WiwoDivider = {
    type: 'divider';
};
/** Los bloques que cualquier sitio wiwo entiende. */
export type WiwoCommonBlock = WiwoParagraph | WiwoHeading | WiwoQuote | WiwoList | WiwoTable | WiwoDivider;
/**
 * Los tipos comunes, para que el manifest de cada sitio los declare sin
 * copiarlos.
 *
 * Se declaran aunque sean comunes: el orquestador arma el editor a partir del
 * manifest, y un sitio que no dibuje tablas no debe ofrecerlas. Un sitio los
 * incluye con `...WIWO_COMMON_BLOCK_TYPES` y añade los suyos detrás.
 */
export declare const WIWO_COMMON_BLOCK_TYPES: WiwoBlockType[];
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
export declare function parseMarkdownBlocks(markdown: string): WiwoBlock[];
