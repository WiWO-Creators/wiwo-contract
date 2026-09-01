import type { WiwoField } from './contract.js';
import { type WiwoArticleDraft } from './write.js';
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
export type WiwoFieldValue = string | string[] | {
    key: string;
    value: string;
}[];
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
/**
 * Identificador a partir del título.
 *
 * Solo se PROPONE: el sitio decide el definitivo. Se quitan los acentos porque
 * la nota termina en una URL, y "políticas" y "politicas" no deben ser dos
 * direcciones distintas.
 */
export declare function proposeId(title: string): string;
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
export declare function buildArticleDraft(fields: WiwoField[], values: WiwoFieldValues, context: WiwoDraftContext): WiwoArticleDraft;
