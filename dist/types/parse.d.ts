import { type WiwoArticlePage, type WiwoManifest } from './contract.js';
/**
 * Reconoce un manifest.
 *
 * Solo exige lo que el orquestador necesita para decidir: la versión y las
 * capacidades. El resto se usa tal como venga, porque un sitio puede declarar
 * campos que este lector todavía no conoce y eso no es un error.
 *
 * @returns El manifest, o null si el valor no lo es.
 */
export declare function parseManifest(value: unknown): WiwoManifest | null;
/** Motivo por el que un manifest no sirve, o null si sirve. */
export declare function describeManifestProblem(manifest: WiwoManifest): string | null;
/**
 * Reconoce una página del listado.
 *
 * Descarta las notas sin id o sin título en vez de rechazar la respuesta
 * entera: una fila rota en el origen no debe esconder a las demás.
 *
 * @returns La página, o null si la respuesta no tiene forma de listado.
 */
export declare function parseArticlePage(value: unknown): WiwoArticlePage | null;
