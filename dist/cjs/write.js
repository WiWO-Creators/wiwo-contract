"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CORE_FIELD_KEYS = exports.WRITE_AUTH_SCHEME = void 0;
exports.parseArticleDraft = parseArticleDraft;
exports.validateAgainstFields = validateAgainstFields;
/**
 * Responsabilidad: la mitad de ESCRITURA del contrato — qué manda el
 * orquestador para publicar una pieza, qué contesta el sitio, y qué se
 * considera válido antes de tocar la base.
 * Usado por: los sitios (para aceptar) y wiwo.doom (para enviar).
 * NO hace: no consulta la red ni guarda nada; solo describe y valida el dato.
 *
 * El borrador es DELIBERADAMENTE simétrico a `WiwoArticle`: lo que el sitio
 * emite al leer es lo mismo que acepta al escribir, menos lo que solo el sitio
 * puede decidir. Esa simetría es lo que hace que el ciclo leer → editar →
 * volver a publicar no pierda nada. Si las dos formas divergen, cada campo que
 * exista en una y no en la otra se borra en silencio al editar una pieza vieja.
 */
/** Cómo se autentica el orquestador contra un sitio. */
exports.WRITE_AUTH_SCHEME = 'Bearer';
/** True si el valor es un objeto plano al que se le pueden leer campos. */
function isRecord(value) {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}
/**
 * Reconoce un borrador que llega por la red.
 *
 * Solo exige la ESTRUCTURA mínima del núcleo. Qué campos son obligatorios lo
 * declara cada sitio en su manifest, y eso se comprueba aparte con
 * `validateAgainstFields`: son dos preguntas distintas y mezclarlas obligaría a
 * este paquete a conocer las reglas de cada sitio.
 *
 * @returns El borrador, o null si el valor no lo es.
 */
function parseArticleDraft(value) {
    if (!isRecord(value))
        return null;
    if (typeof value.title !== 'string' || value.title.trim() === '')
        return null;
    if (!isRecord(value.body))
        return null;
    const body = value.body;
    const esMarkdown = body.format === 'markdown' && typeof body.markdown === 'string';
    const esBloques = body.format === 'blocks' && Array.isArray(body.blocks);
    if (!esMarkdown && !esBloques)
        return null;
    if (value.id !== undefined && typeof value.id !== 'string')
        return null;
    return value;
}
/**
 * Dónde vive, dentro de una pieza, el valor de cada campo del núcleo.
 *
 * Hace falta una tabla explícita porque el núcleo guarda varios campos
 * ENVUELTOS: el manifest declara `section` como una lista de identificadores,
 * pero la pieza lleva `section: { id, label }`. Comparar el objeto contra la
 * lista rechaza un valor correcto, que es exactamente lo que pasaba antes de
 * que esta tabla existiera.
 *
 * Es la misma tabla en las dos direcciones: el orquestador la usa para ARMAR la
 * pieza desde el formulario y el sitio para LEERLA al validar. Si cada lado
 * tuviera la suya, un campo se guardaría en un sitio y se buscaría en otro.
 */
const EN_EL_NUCLEO = {
    title: (d) => d.title,
    summary: (d) => d.summary,
    tags: (d) => d.tags,
    featured: (d) => d.featured,
    publishedAt: (d) => d.publishedAt,
    readingMinutes: (d) => d.readingMinutes,
    rank: (d) => d.rank,
    section: (d) => d.section?.id,
    author: (d) => d.author?.name,
    image: (d) => d.image?.url,
    imageAlt: (d) => d.image?.alt,
    // El cuerpo se juzga por su CONTENIDO: el envoltorio nunca está vacío, así que
    // mirarlo a él daría por rellenado un cuerpo sin una sola palabra.
    body: (d) => d.body?.format === 'markdown' ? d.body.markdown : d.body?.blocks,
};
/** Las claves del manifest que el núcleo del contrato cubre. */
exports.CORE_FIELD_KEYS = Object.keys(EN_EL_NUCLEO);
/**
 * Dónde vive el valor de un campo del manifest dentro del borrador.
 *
 * Primero el núcleo, y si ahí no hay nada, `extra`. Ese respaldo no es
 * casualidad: un sitio puede declarar un campo propio con el mismo nombre que
 * uno del núcleo, y rechazarlo por mirar solo un lado sería arbitrario.
 */
function readField(draft, key) {
    const enNucleo = EN_EL_NUCLEO[key];
    if (enNucleo) {
        const valor = enNucleo(draft);
        if (!estaVacio(valor))
            return valor;
    }
    return draft.extra?.[key];
}
/** True si el valor cuenta como "no rellenado". */
function estaVacio(valor) {
    if (valor === undefined || valor === null)
        return true;
    if (typeof valor === 'string')
        return valor.trim() === '';
    if (Array.isArray(valor))
        return valor.length === 0;
    return false;
}
/**
 * Comprueba el borrador contra los campos que el sitio declara en su manifest.
 *
 * Existe acá, y no repetida en cada sitio, porque con cien sitios la misma
 * comprobación escrita cien veces diverge: uno olvida un obligatorio, otro
 * acepta un valor fuera de la lista, y el orquestador recibe errores distintos
 * para el mismo problema.
 *
 * @param draft Borrador ya reconocido por `parseArticleDraft`.
 * @param fields Los campos del manifest del sitio.
 * @returns Un mapa de clave a motivo. Vacío significa que el borrador sirve.
 */
function validateAgainstFields(draft, fields) {
    const errores = {};
    for (const field of fields) {
        const valor = readField(draft, field.key);
        if (estaVacio(valor)) {
            if (field.required)
                errores[field.key] = `Falta "${field.label}".`;
            // Un campo opcional vacío no se comprueba más: no hay valor que juzgar.
            continue;
        }
        if (field.type === 'enum') {
            const permitidos = (field.options ?? []).map((option) => option.value);
            // Un enum sin opciones es un manifest incompleto: no hay contra qué
            // comparar, y rechazar todo dejaría el sitio imposible de publicar.
            if (permitidos.length > 0 && !permitidos.includes(valor)) {
                errores[field.key] = `"${field.label}" no admite ese valor.`;
            }
            continue;
        }
        if (field.type === 'number' && typeof valor !== 'number') {
            errores[field.key] = `"${field.label}" tiene que ser un número.`;
        }
    }
    return errores;
}
