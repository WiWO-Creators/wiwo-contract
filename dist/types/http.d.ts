/**
 * Responsabilidad: el envoltorio HTTP del contrato — resolver el origen público
 * de una petición y devolver JSON con las cabeceras correctas.
 * Usado por: los sitios, en sus rutas /api/wiwo/v1/.
 * NO hace: no arma el contenido de la respuesta.
 *
 * Vive en el paquete porque es la parte que tiene que ser idéntica en todos los
 * sitios: si uno cachea distinto o resuelve mal su dominio, el orquestador ve
 * una identidad distinta de la misma nota y la duplica.
 */
/** Prefijo del contrato dentro de un sitio. Igual en todas las páginas. */
export declare const CONTRACT_PATH = "/api/wiwo/v1";
/**
 * Origen público por el que entró la petición.
 *
 * Se deriva de la petición y no de una constante porque un sitio suele responder
 * en más de un dominio (el propio y el de su plataforma). Todas las URLs que
 * emite el contrato quedan así en el mismo dominio por el que preguntó el
 * orquestador, y la deduplicación del otro lado no ve dos identidades de la
 * misma nota.
 *
 * Es a propósito independiente del `<link rel="canonical">` del sitio: hay
 * sitios cuyo canonical apunta al dominio de la plataforma, y heredar ese error
 * lo propagaría al orquestador.
 */
export declare function publicOrigin(request: Request): string;
/**
 * Respuesta JSON del contrato.
 *
 * Se permite cualquier origen porque todo lo que sale por acá ya es público en
 * el sitio: son las mismas notas que cualquiera lee sin identificarse. Cuando se
 * agregue publicación, ese endpoint sí exigirá clave y no llevará esta cabecera.
 */
export declare function jsonResponse(body: unknown, status?: number): Response;
/** Error del contrato, con el mismo sobre que una respuesta normal. */
export declare function errorResponse(message: string, status: number): Response;
/** True si el valor tiene forma de fecha ISO AAAA-MM-DD. */
export declare function isIsoDate(value: string): boolean;
