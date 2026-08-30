/**
 * Responsabilidad: paginar un listado de notas con un cursor estable.
 * Usado por: los sitios, al responder /articles.
 * NO hace: no ordena ni conoce el modelo de ningún sitio; recibe la lista ya
 * ordenada.
 *
 * Existe porque el listado devuelve las notas enteras, cuerpo incluido, y eso
 * no tiene techo: medido, una nota pesa unos 12 KB, así que un sitio con más de
 * ochenta supera el megabyte que el orquestador acepta y queda descartado
 * ENTERO. Con cursor, cada respuesta está acotada y el lector sigue pidiendo.
 *
 * El cursor apunta al último elemento entregado, no a un número de página: si
 * entre dos pedidos se publica algo, un índice numérico saltearía o repetiría
 * una nota, y el cursor no.
 */
/** Cuántas notas se devuelven cuando el lector no pide un tamaño. */
export declare const DEFAULT_PAGE_SIZE = 25;
/**
 * Tope duro por respuesta.
 *
 * Con notas de ~12 KB, cien son ~1,2 MB: justo por encima de lo que el
 * orquestador acepta. Cincuenta deja la respuesta cerca de 600 KB en el peor
 * caso y sigue siendo pocas vueltas para un archivo grande.
 */
export declare const MAX_PAGE_SIZE = 50;
/**
 * Lleva el tamaño pedido a un valor admisible.
 *
 * @param raw Valor crudo del parámetro `limit`. Ausente, vacío o no numérico
 *   devuelve el tamaño predefinido; fuera de rango se recorta en vez de fallar,
 *   porque un lector que pide de más no está haciendo nada malo.
 */
export declare function resolvePageSize(raw: string | null | undefined): number;
/**
 * Arma el cursor que apunta a un elemento.
 *
 * Se codifica en base64url para que sea opaco: si fuera legible, alguien lo
 * construiría a mano y el sitio no podría cambiar cómo pagina.
 */
export declare function encodeCursor(id: string): string;
/**
 * Devuelve el id que el cursor señala, o null si el cursor no es legible.
 *
 * No alcanza con envolver la decodificación en un try: Buffer.from con base64url
 * NO falla ante caracteres inválidos, los ignora, y devuelve texto corrupto.
 * Por eso se comprueba el alfabeto y se verifica que el valor vuelva a producir
 * el mismo cursor: solo un cursor que emitimos nosotros sobrevive las dos.
 */
export declare function decodeCursor(cursor: string): string | null;
/** Una porción del listado, lista para responder. */
export type Slice<T> = {
    items: T[];
    nextCursor: string | null;
};
/**
 * Corta una porción de la lista a partir del cursor.
 *
 * @param sorted Lista COMPLETA y ya ordenada. El orden lo decide cada sitio,
 *   pero tiene que ser estable entre pedidos o el cursor no significa nada.
 * @param idOf Cómo obtener el identificador de un elemento.
 * @param pageSize Cuántos devolver.
 * @param cursor Cursor recibido. Ausente = desde el principio.
 * @returns La porción y el cursor siguiente, o null si no queda nada.
 *
 * Un cursor que ya no existe —porque esa nota se despublicó— se trata como si
 * no hubiera cursor: es preferible que el lector reciba el listado desde el
 * principio a que reciba un error y se quede sin nada.
 */
export declare function sliceByCursor<T>(sorted: T[], idOf: (item: T) => string, pageSize: number, cursor?: string | null): Slice<T>;
