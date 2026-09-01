"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.proposeId = proposeId;
exports.buildArticleDraft = buildArticleDraft;
const blocks_js_1 = require("./blocks.js");
const write_js_1 = require("./write.js");
/** El texto de un campo, o cadena vacía si no es texto. */
function texto(valor) {
    return typeof valor === 'string' ? valor.trim() : '';
}
/** La lista de un campo, venga ya como lista o como texto separado por comas. */
function lista(valor) {
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
function pares(valor) {
    if (!Array.isArray(valor))
        return [];
    return valor
        .filter((v) => typeof v !== 'string')
        .filter((par) => par.key.trim() !== '' && par.value.trim() !== '');
}
/** El número de un campo, o null si no hay nada que interpretar. */
function numero(valor) {
    const crudo = texto(valor);
    if (!crudo)
        return null;
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
function proposeId(title) {
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
function etiquetaDe(campo, valor) {
    return campo?.options?.find((option) => option.value === valor)?.label ?? valor;
}
/**
 * El cuerpo, en la forma que el sitio declaró que acepta.
 *
 * Un sitio que pide bloques no sabe mostrar Markdown: su plantilla recorre el
 * cuerpo bloque a bloque. Mandarle una cadena lo dejaría guardando una nota que
 * no puede dibujar, sin ningún error.
 */
function cuerpoPara(campo, escrito) {
    return campo?.type === 'blocks'
        ? { format: 'blocks', blocks: (0, blocks_js_1.parseMarkdownBlocks)(escrito) }
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
function buildArticleDraft(fields, values, context) {
    const porClave = new Map(fields.map((campo) => [campo.key, campo]));
    const v = (clave) => values[clave];
    const title = texto(v('title'));
    const seccion = texto(v('section'));
    const firma = texto(v('author'));
    const campoAutor = porClave.get('author');
    const delNucleo = new Set(write_js_1.CORE_FIELD_KEYS);
    const extra = Object.fromEntries(fields
        .filter((campo) => !delNucleo.has(campo.key))
        .map((campo) => [campo.key, values[campo.key]])
        .filter(([, valor]) => {
        if (typeof valor === 'string')
            return valor.trim() !== '';
        return Array.isArray(valor) && valor.length > 0;
    }));
    return {
        id: context.id ?? proposeId(title),
        title,
        summary: texto(v('summary')),
        section: { id: seccion, label: etiquetaDe(porClave.get('section'), seccion) },
        // Un sitio que elige autor de una lista cerrada identifica por slug; uno que
        // firma con una línea editorial solo tiene el nombre. Se emiten los dos para
        // que el sitio reconozca al suyo sin que el orquestador sepa cuál usa.
        author: campoAutor?.type === 'enum'
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
