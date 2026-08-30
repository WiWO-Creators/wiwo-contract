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
export const CONTRACT_PATH = '/api/wiwo/v1';
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
export function publicOrigin(request) {
    const forwardedHost = request.headers.get('x-forwarded-host');
    if (!forwardedHost)
        return new URL(request.url).origin;
    const protocol = request.headers.get('x-forwarded-proto') ?? 'https';
    return `${protocol}://${forwardedHost}`;
}
/**
 * Cachea un minuto en el borde y sirve hasta cinco minutos vencido mientras
 * revalida. El contenido se despliega con el sitio, así que no cambia entre
 * builds: cachear de más solo retrasaría una nota nueva unos segundos.
 */
const CACHE_CONTROL = 'public, max-age=0, s-maxage=60, stale-while-revalidate=300';
/**
 * Respuesta JSON del contrato.
 *
 * Se permite cualquier origen porque todo lo que sale por acá ya es público en
 * el sitio: son las mismas notas que cualquiera lee sin identificarse. Cuando se
 * agregue publicación, ese endpoint sí exigirá clave y no llevará esta cabecera.
 */
export function jsonResponse(body, status = 200) {
    return new Response(JSON.stringify(body), {
        status,
        headers: {
            'content-type': 'application/json; charset=utf-8',
            'cache-control': CACHE_CONTROL,
            'access-control-allow-origin': '*',
        },
    });
}
/** Error del contrato, con el mismo sobre que una respuesta normal. */
export function errorResponse(message, status) {
    return jsonResponse({ error: message }, status);
}
/** True si el valor tiene forma de fecha ISO AAAA-MM-DD. */
export function isIsoDate(value) {
    return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value));
}
