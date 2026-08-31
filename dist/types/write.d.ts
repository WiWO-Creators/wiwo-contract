import type { WiwoArticle, WiwoField } from './contract.js';
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
export declare const WRITE_AUTH_SCHEME = "Bearer";
/**
 * Lo que el orquestador manda para crear o reemplazar una pieza.
 *
 * Se van tres campos respecto de `WiwoArticle`, y por el mismo motivo: los
 * decide el sitio, no quien escribe.
 *
 * - `url`: la arma el sitio con su propio esquema de rutas.
 * - `updatedAt`: es el reloj del sitio. Si lo pusiera el emisor, dos relojes
 *   desfasados romperían la sincronización incremental, que es justo lo que ese
 *   campo existe para sostener.
 * - `id`: opcional. Ausente, el sitio lo deriva (del título, normalmente).
 *   Presente, es una propuesta que el sitio puede rechazar si ya existe.
 */
export type WiwoArticleDraft = Omit<WiwoArticle, 'id' | 'url' | 'updatedAt'> & {
    id?: string;
};
/** Lo que contesta el sitio cuando la escritura salió bien. */
export type WiwoWriteResult = {
    /** El identificador REAL, que puede no ser el propuesto. */
    id: string;
    url: string;
    /** El reloj del sitio. El orquestador lo guarda para la próxima edición. */
    updatedAt: string;
};
/**
 * Por qué falló una escritura.
 *
 * Es un conjunto cerrado para que el orquestador pueda REACCIONAR y no solo
 * mostrar texto: reintentar, pedir la clave, o avisar de un choque de ediciones
 * son respuestas distintas.
 */
export type WiwoWriteErrorCode = 
/** Falta la clave o no es la del sitio. */
'unauthorized'
/** El sitio no acepta escrituras (`capabilities.write` en false). */
 | 'not_supported'
/** El borrador no cumple lo que el manifest declara. Mira `fields`. */
 | 'validation'
/** Se quiso crear algo que ya existe, o editar algo que cambió mientras. */
 | 'conflict'
/** Se quiso editar una pieza que el sitio no tiene. */
 | 'not_found';
export type WiwoWriteError = {
    code: WiwoWriteErrorCode;
    /** Texto listo para mostrar. */
    message: string;
    /**
     * Qué campo falló y por qué, por clave del manifest. Presente solo en
     * `validation`. Permite marcar el error EN el campo del formulario en vez de
     * dar un aviso genérico que obliga a adivinar cuál de diecinueve campos es.
     */
    fields?: Record<string, string>;
};
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
export declare function parseArticleDraft(value: unknown): WiwoArticleDraft | null;
/** Las claves del manifest que el núcleo del contrato cubre. */
export declare const CORE_FIELD_KEYS: string[];
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
export declare function validateAgainstFields(draft: WiwoArticleDraft, fields: WiwoField[]): Record<string, string>;
