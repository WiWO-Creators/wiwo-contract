"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WIWO_MEDIA_MAX_BYTES = exports.WIWO_MEDIA_TYPES = exports.WIWO_MEDIA_TABLE = void 0;
exports.mediaId = mediaId;
exports.mediaContentType = mediaContentType;
exports.parseMediaUpload = parseMediaUpload;
/**
 * Responsabilidad: la mitad de MEDIOS del contrato — qué archivos acepta un
 * sitio, cómo se los identifica y cómo se valida uno que llega.
 * Usado por: server.ts, que monta los endpoints; y el orquestador, que sabe qué
 *   puede mandar antes de mandarlo.
 * NO hace: no guarda ni sirve nada; eso es server.ts, que es donde vive el SQL.
 *
 * Existe porque sin ella una nota no se puede ilustrar. El campo de imagen de un
 * manifest pide una URL, y hasta acá el orquestador solo podía PEGAR una: quien
 * tenía el archivo en su computadora no tenía a dónde subirlo, y pegar la ruta
 * del disco publica una nota con una imagen que solo existe en esa máquina.
 *
 * El archivo se guarda en el SITIO y no en el orquestador. Es la misma regla que
 * el resto del contrato: el contenido vive en cada página. Si las imágenes se
 * sirvieran desde el orquestador, cien sitios públicos quedarían mostrando fotos
 * que dependen de que una herramienta interna esté en pie.
 */
/** Tabla donde cada sitio guarda los archivos que le subieron. */
exports.WIWO_MEDIA_TABLE = 'wiwo_media';
/**
 * Formatos que acepta un sitio, y con qué extensión los sirve.
 *
 * Solo imágenes: es lo que los manifests piden hoy. La lista es cerrada a
 * propósito —no se acepta cualquier `image/*`— porque un SVG es un documento que
 * puede traer script adentro, y servirlo desde el dominio del sitio lo
 * convertiría en una vía de inyección contra sus propios lectores.
 */
exports.WIWO_MEDIA_TYPES = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'image/avif': 'avif',
    'image/gif': 'gif',
};
/**
 * Tope de un archivo, en bytes.
 *
 * Cinco megas cubre con holgura una ilustración editorial y corta el pegado
 * accidental de un original de cámara. El límite se comprueba dos veces —por la
 * cabecera y por los bytes leídos— porque `content-length` lo pone quien manda.
 */
exports.WIWO_MEDIA_MAX_BYTES = 5 * 1024 * 1024;
/**
 * Identificador de un archivo: el hash de su contenido, más su extensión.
 *
 * Se deriva del CONTENIDO y no del nombre por dos razones. Subir dos veces la
 * misma imagen da el mismo identificador, así que no se acumulan copias de lo
 * mismo. Y como el identificador no puede apuntar a otro contenido, la URL se
 * puede cachear para siempre, que es lo que hace que una imagen no se vuelva a
 * descargar en cada visita.
 *
 * El nombre original no se usa: viene de quien sube y traería acentos, espacios
 * y hasta rutas enteras a una URL pública.
 */
async function mediaId(data, contentType) {
    const digest = await crypto.subtle.digest('SHA-256', data);
    const hex = Array.from(new Uint8Array(digest))
        .map((byte) => byte.toString(16).padStart(2, '0'))
        .join('');
    return `${hex.slice(0, 32)}.${exports.WIWO_MEDIA_TYPES[contentType]}`;
}
/** El tipo de contenido de un archivo guardado, por su extensión. */
function mediaContentType(id) {
    const extension = id.slice(id.lastIndexOf('.') + 1);
    const encontrado = Object.entries(exports.WIWO_MEDIA_TYPES).find(([, propia]) => propia === extension);
    return encontrado ? encontrado[0] : null;
}
/**
 * Lee y valida el archivo que llega en una petición.
 *
 * El cuerpo son los BYTES en crudo y el tipo viaja en `content-type`. No es
 * multipart a propósito: quien sube no es un formulario del navegador sino el
 * orquestador, así que no hace falta un analizador de multipart —que cada
 * plataforma implementa un poco distinto— para mandar un archivo.
 *
 * @returns El archivo listo para guardar, o el error que corresponde devolver.
 */
async function parseMediaUpload(request) {
    const contentType = (request.headers.get('content-type') ?? '')
        .split(';')[0]
        .trim()
        .toLowerCase();
    if (!exports.WIWO_MEDIA_TYPES[contentType]) {
        return {
            code: 'validation',
            message: `Este sitio acepta ${Object.keys(exports.WIWO_MEDIA_TYPES).join(', ')}; llegó "${contentType || 'nada'}".`,
        };
    }
    // Se mira la cabecera antes de leer: rechazar acá evita traerse cincuenta
    // megas a memoria solo para descartarlos.
    const declarado = Number(request.headers.get('content-length'));
    if (Number.isFinite(declarado) && declarado > exports.WIWO_MEDIA_MAX_BYTES) {
        return demasiadoGrande(declarado);
    }
    let data;
    try {
        data = new Uint8Array(await request.arrayBuffer());
    }
    catch {
        return { code: 'validation', message: 'No se pudo leer el archivo.' };
    }
    // Y de nuevo por los bytes de verdad: `content-length` lo declara quien manda.
    if (data.byteLength > exports.WIWO_MEDIA_MAX_BYTES) {
        return demasiadoGrande(data.byteLength);
    }
    if (data.byteLength === 0) {
        return { code: 'validation', message: 'El archivo llegó vacío.' };
    }
    return {
        id: await mediaId(data, contentType),
        contentType,
        bytes: data.byteLength,
        data,
    };
}
function demasiadoGrande(bytes) {
    const mega = (valor) => `${(valor / (1024 * 1024)).toFixed(1)} MB`;
    return {
        code: 'validation',
        message: `El archivo pesa ${mega(bytes)} y el máximo es ${mega(exports.WIWO_MEDIA_MAX_BYTES)}.`,
    };
}
