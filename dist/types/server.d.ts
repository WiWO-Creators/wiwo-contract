import type { WiwoArticle, WiwoField, WiwoSiteArticle } from './contract.js';
import type { WiwoWriteError } from './write.js';
import { type WiwoMediaStore } from './media.js';
/**
 * Responsabilidad: el lado servidor del contrato — guardar, leer y aceptar
 * notas, con el mismo comportamiento en todos los sitios.
 * Usado por: cada sitio, en su ruta /api/wiwo/v1/articles.
 * NO hace: no sabe qué campos exige un sitio ni cómo son sus URLs; eso llega por
 *   configuración. Tampoco abre la base: recibe un ejecutor de SQL ya resuelto.
 *
 * Vive acá y no en cada sitio porque es exactamente la parte que NO puede
 * diferir. Con cien sitios copiando este archivo, cada copia envejece a su ritmo
 * y el orquestador termina hablando con cien protocolos parecidos pero
 * distintos: uno que ordena al revés rompe el cursor de paginación, otro que
 * fecha con el reloj de quien publica rompe la sincronización incremental. Lo
 * que cambia por sitio es su formato, no su protocolo.
 */
/**
 * La superficie mínima de base de datos que necesita el contrato.
 *
 * Es un subconjunto de lo que exponen los sitios, a propósito: pedir menos deja
 * que cualquier ejecutor de SQL sirva sin adaptarlo.
 */
export interface WiwoSql {
    query<T = Record<string, unknown>>(text: string, params?: unknown[]): Promise<T[]>;
}
/** Tabla donde cada sitio guarda lo que publicó el orquestador. */
export declare const WIWO_ARTICLES_TABLE = "wiwo_articles";
/** Lo que guarda y devuelve un sitio de las notas que le publicaron. */
export interface WiwoArticleStore {
    /** Las notas publicadas, o vacío si la base no está disponible. */
    read(since?: string): Promise<WiwoSiteArticle[]>;
    /** Una nota por su identificador, o null si no está. */
    find(id: string): Promise<WiwoSiteArticle | null>;
    /** Guarda una nota, reemplazándola si ya existía. */
    save(article: WiwoSiteArticle): Promise<void>;
    /**
     * Borra una nota publicada.
     *
     * Alcanza SOLO a lo que el orquestador publicó, que es lo que vive en la base.
     * El archivo editorial del repositorio del sitio no se puede tocar desde acá:
     * es código, y lo que un sitio trae en su código no es asunto del protocolo.
     *
     * @returns True si había algo que borrar. False si esa nota no estaba, que es
     *   lo que permite contestar 404 en vez de decir que se borró algo inexistente.
     */
    remove(id: string): Promise<boolean>;
}
/**
 * El almacén de notas publicadas de un sitio.
 *
 * La nota se guarda en la forma del CONTRATO, no en el modelo interno del sitio.
 * Traducirla de ida y vuelta pediría un adaptador inverso completo, y cada campo
 * que ese adaptador no cubriera se perdería en silencio al editar una nota ya
 * publicada.
 *
 * @param getSql Cómo obtener el ejecutor de SQL del sitio. Se pide como función
 *   y no como valor porque abrir la base es asíncrono y solo ocurre en el
 *   servidor.
 */
export declare function createArticleStore(getSql: () => Promise<WiwoSql>): WiwoArticleStore;
/**
 * El almacén de archivos de un sitio, sobre su propia base.
 *
 * Los bytes van en la misma base que las notas y no en el disco: los sitios
 * corren en plataformas donde el sistema de archivos es de solo lectura, así que
 * un archivo escrito en disco desaparece en el despliegue siguiente. La base es
 * lo único que ya tienen todos y que sobrevive.
 *
 * @param getSql Cómo obtener el ejecutor de SQL del sitio. Se recibe como
 *   función porque abrir la base es asíncrono y no debe pasar al importar.
 */
export declare function createMediaStore(getSql: () => Promise<WiwoSql>): WiwoMediaStore;
/**
 * El orden en que las notas salen al cable.
 *
 * De la más nueva a la más vieja; dentro del mismo día manda `rank` —la
 * curaduría de portada del sitio— y, si tampoco desempata, el identificador.
 * Tiene que ser total y estable entre pedidos o el cursor de paginación deja de
 * significar algo: dos notas que cambian de posición entre dos páginas se
 * repiten o se pierden.
 */
export declare function compareArticles(a: WiwoSiteArticle, b: WiwoSiteArticle): number;
/**
 * Une el archivo del repositorio con lo publicado por el orquestador.
 *
 * Cuando una nota está en los dos lados gana la de la base: el archivo del
 * repositorio es lo que se publicó originalmente y la base es lo que se corrigió
 * después.
 */
export declare function mergeArticles(archivo: WiwoSiteArticle[], publicadas: WiwoSiteArticle[]): WiwoSiteArticle[];
/** Lo que un sitio aporta al protocolo: su formato, sus URLs y su almacén. */
export interface WiwoSiteConfig {
    /** Dónde viven las notas que publicó el orquestador. */
    store: WiwoArticleStore;
    /**
     * El archivo editorial del propio repositorio.
     *
     * Ya viene en la forma del contrato: el sitio guarda esa forma, no la suya.
     * No recibe el origen porque no le hace falta — las URLs las resuelve el
     * contrato al salir al cable, y así el archivo es un dato puro.
     *
     * @param since Fecha ISO (AAAA-MM-DD). Solo las CAMBIADAS ese día o después
     *   —publicadas o corregidas—, que es lo que permite que una nota vieja
     *   corregida hoy vuelva a viajar. Ausente = todas.
     */
    archive(since?: string): WiwoSiteArticle[] | Promise<WiwoSiteArticle[]>;
    /** Los campos que el sitio exige para aceptar una nota. */
    fields(origin: string): WiwoField[];
    /** La URL pública de una nota en este sitio. */
    urlFor(id: string, origin: string): string;
    /**
     * Dónde guarda este sitio las imágenes que le suban.
     *
     * Opcional: un sitio que no lo declare sigue sirviendo notas igual, y su
     * manifest anuncia `media: false` para que el orquestador no ofrezca subir
     * archivos a un destino que no puede recibirlos.
     */
    media?: WiwoMediaConfig;
}
/** La mitad de medios de un sitio. */
export interface WiwoMediaConfig {
    /** Dónde viven los archivos subidos. */
    store: WiwoMediaStore;
    /** La URL pública de un archivo en este sitio. */
    urlFor(id: string, origin: string): string;
}
/**
 * Comprueba que quien escribe sea el orquestador.
 *
 * Dos capas, no una. La clave sola basta para el uso normal, pero con cien
 * sitios repartiendo la misma clase de credencial, una filtrada se usa desde
 * cualquier parte; el orquestador sale siempre desde la misma IP, así que
 * acotarlo cuesta una variable y cierra ese caso.
 *
 * Lee `WIWO_WRITE_TOKEN` y, opcionalmente, `WIWO_WRITE_IPS` del entorno del
 * sitio. Sin la primera el sitio no acepta publicaciones; sin la segunda, la
 * clave es la única puerta.
 *
 * @returns Null si puede escribir, o el error que corresponde.
 */
export declare function denyWrite(request: Request): WiwoWriteError | null;
/**
 * True si el sitio tiene configurada la clave de publicación.
 *
 * Es lo que el manifest anuncia como `capabilities.write`: sin clave el endpoint
 * existe pero rechaza todo, así que anunciarlo haría que el orquestador
 * ofreciera un destino que no puede recibir nada.
 */
export declare function canWrite(): boolean;
/**
 * Todas las notas que el sitio publica al cable: las del repositorio MÁS las que
 * publicó el orquestador, unidas y ordenadas.
 */
export declare function allArticles(config: WiwoSiteConfig, origin: string, since?: string): Promise<WiwoArticle[]>;
/**
 * Los manejadores HTTP del contrato para un sitio.
 *
 * Devuelve la nota entera, cuerpo incluido, y por eso pagina: una nota pesa unos
 * 12 KB, así que un archivo grande sin paginar supera el tamaño que el
 * orquestador acepta y quedaría descartado ENTERO, no truncado.
 *
 * @param config Lo propio del sitio: su almacén, su archivo, sus campos y sus
 *   URLs.
 */
/**
 * True si este sitio puede recibir archivos.
 *
 * Es lo que el manifest anuncia como `capabilities.media`: hacen falta las dos
 * cosas, un lugar donde guardarlos y la clave de escritura, porque subir un
 * archivo es escribir. Anunciarlo sin alguna de las dos haría que el orquestador
 * ofreciera subir a un destino que va a rechazar todo.
 */
export declare function canWriteMedia(config: WiwoSiteConfig): boolean;
/**
 * True si este sitio acepta que le borren una nota publicada.
 *
 * Es lo que el manifest anuncia como `capabilities.delete`. Hoy es lo mismo que
 * poder escribir —borrar es escribir, y la puerta es la misma clave— pero se
 * declara aparte porque son permisos distintos: un sitio podría querer recibir
 * publicaciones sin que nadie pueda vaciarlas remotamente, y ese día esto es una
 * variable de entorno más y no un cambio de protocolo.
 */
export declare function canDelete(): boolean;
/**
 * El endpoint que RECIBE archivos: POST /api/wiwo/v1/media.
 *
 * Pide la misma clave que publicar una nota, y por el mismo motivo: subir un
 * archivo escribe en el sitio, y sin clave cualquiera podría llenarle la base de
 * imágenes ajenas.
 *
 * Contesta 201 con la URL pública, que es lo único que le sirve a quien sube: se
 * pega tal cual en el campo de imagen de la nota.
 */
export declare function createMediaHandlers(config: WiwoSiteConfig): {
    POST(ctx: {
        request: Request;
    }): Promise<Response>;
};
/**
 * El endpoint que SIRVE archivos: GET /api/wiwo/v1/media/:id.
 *
 * Es público, como el resto de lo que el sitio publica: la imagen de una nota la
 * ve cualquiera que lea la nota, y pedir clave para verla rompería la página.
 *
 * Se cachea para siempre porque el identificador es el hash del contenido: esa
 * URL no puede pasar a significar otra imagen, así que revalidarla no cambiaría
 * nunca nada.
 */
export declare function createMediaFileHandlers(config: WiwoSiteConfig): {
    GET(ctx: {
        request: Request;
        params: {
            id: string;
        };
    }): Promise<Response>;
};
export declare function createArticlesHandlers(config: WiwoSiteConfig): {
    GET(ctx: {
        request: Request;
    }): Promise<Response>;
    POST(ctx: {
        request: Request;
    }): Promise<Response>;
    DELETE(ctx: {
        request: Request;
    }): Promise<Response>;
};
