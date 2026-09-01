import type { WiwoWriteError } from './write.js';
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
export declare const WIWO_MEDIA_TABLE = "wiwo_media";
/**
 * Formatos que acepta un sitio, y con qué extensión los sirve.
 *
 * Solo imágenes: es lo que los manifests piden hoy. La lista es cerrada a
 * propósito —no se acepta cualquier `image/*`— porque un SVG es un documento que
 * puede traer script adentro, y servirlo desde el dominio del sitio lo
 * convertiría en una vía de inyección contra sus propios lectores.
 */
export declare const WIWO_MEDIA_TYPES: Readonly<Record<string, string>>;
/**
 * Tope de un archivo, en bytes.
 *
 * Cinco megas cubre con holgura una ilustración editorial y corta el pegado
 * accidental de un original de cámara. El límite se comprueba dos veces —por la
 * cabecera y por los bytes leídos— porque `content-length` lo pone quien manda.
 */
export declare const WIWO_MEDIA_MAX_BYTES: number;
/** Un archivo listo para guardar, ya validado e identificado. */
export interface WiwoMediaFile {
    /** Identificador con extensión, derivado del contenido. */
    id: string;
    contentType: string;
    bytes: number;
    data: Uint8Array;
}
/** Un archivo que ya estaba guardado. */
export interface WiwoStoredMedia {
    contentType: string;
    data: Uint8Array;
}
/** Lo que el sitio contesta cuando aceptó un archivo. */
export interface WiwoMediaResult {
    /** URL pública, la que va al campo de imagen de la nota. */
    url: string;
    id: string;
    contentType: string;
    bytes: number;
}
/** Dónde guarda y de dónde lee un sitio los archivos que le subieron. */
export interface WiwoMediaStore {
    /** Guarda el archivo. Repetir el mismo no duplica nada. */
    save(file: WiwoMediaFile): Promise<void>;
    /** Un archivo por su identificador, o null si no está. */
    find(id: string): Promise<WiwoStoredMedia | null>;
}
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
export declare function mediaId(data: Uint8Array, contentType: string): Promise<string>;
/** El tipo de contenido de un archivo guardado, por su extensión. */
export declare function mediaContentType(id: string): string | null;
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
export declare function parseMediaUpload(request: Request): Promise<WiwoMediaFile | WiwoWriteError>;
