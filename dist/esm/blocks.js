/**
 * Los tipos comunes, para que el manifest de cada sitio los declare sin
 * copiarlos.
 *
 * Se declaran aunque sean comunes: el orquestador arma el editor a partir del
 * manifest, y un sitio que no dibuje tablas no debe ofrecerlas. Un sitio los
 * incluye con `...WIWO_COMMON_BLOCK_TYPES` y añade los suyos detrás.
 */
export const WIWO_COMMON_BLOCK_TYPES = [
    { type: 'paragraph', label: 'Párrafo' },
    { type: 'heading', label: 'Subtítulo' },
    { type: 'quote', label: 'Cita destacada' },
    { type: 'list', label: 'Lista' },
    { type: 'table', label: 'Tabla' },
    { type: 'divider', label: 'Separador' },
];
/** True si el bloque es de una fila de tabla en Markdown. */
function esTabla(bloque) {
    const lineas = bloque.trim().split('\n');
    return lineas.length >= 2 && lineas[0].includes('|') && lineas[1].includes('---');
}
/** Parte una fila de tabla en celdas. */
function celdas(linea) {
    return linea
        .replace(/^\|/, '')
        .replace(/\|$/, '')
        .split('|')
        .map((c) => c.trim());
}
/** Convierte un bloque de tabla en su forma estructurada. */
function aTabla(bloque) {
    const filas = bloque
        .trim()
        .split('\n')
        .filter((l) => l.trim() && !/^\|?\s*-+\s*\|/.test(l))
        .map(celdas);
    const [head = [], ...rows] = filas;
    return { type: 'table', head, rows };
}
/** Convierte un bloque de lista en su forma estructurada. */
function aLista(bloque) {
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
export function parseMarkdownBlocks(markdown) {
    return markdown
        .trim()
        .split(/\n{2,}/)
        .map((bloque) => bloque.trim())
        .filter(Boolean)
        .map((bloque) => {
        if (bloque === '---')
            return { type: 'divider' };
        if (esTabla(bloque))
            return aTabla(bloque);
        const encabezado = bloque.match(/^#{1,6}\s+(.*)$/s);
        if (encabezado)
            return { type: 'heading', text: encabezado[1].trim() };
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
        if (/^[-*]\s/.test(bloque) || /^\d+\.\s/.test(bloque))
            return aLista(bloque);
        return { type: 'paragraph', text: bloque.replace(/\n/g, ' ') };
    });
}
