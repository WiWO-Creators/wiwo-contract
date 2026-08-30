/**
 * Responsabilidad: la forma del contrato wiwo — los tipos que viajan entre un
 * sitio y el orquestador, y qué versiones se hablan.
 * Usado por: los sitios (para emitir) y wiwo.doom (para leer).
 * NO hace: no valida ni consulta la red; solo describe el dato.
 *
 * Esta es la ÚNICA definición del contrato. Antes vivía copiada en cada
 * repositorio y había que mantener las copias a mano; con 100 sitios eso no se
 * sostiene. Un cambio acá se propaga instalando una versión nueva del paquete.
 *
 * El núcleo es chico y neutro a propósito: solo lo que cualquier publicación
 * tiene. Todo lo propio de un sitio viaja en `extra` sin que el orquestador lo
 * entienda, y qué significa cada cosa lo explica el manifest. Dos sitios reales
 * lo justifican: uno tiene ficha de autor y cuerpo en bloques, el otro firma con
 * una línea de texto y escribe en Markdown. Un contrato que exigiera la forma
 * del primero dejaría al segundo afuera.
 */
/**
 * Versión que emite este paquete.
 *
 * 1.1 agregó paginación en el listado y `updatedAt` con significado propio. Los
 * dos cambios son aditivos: un lector de 1.0 sigue funcionando contra un sitio
 * 1.1 porque ignora los campos nuevos.
 */
export const WIWO_CONTRACT_VERSION = '1.1';
/**
 * Versiones que un lector de esta versión del paquete sabe interpretar.
 *
 * Existe porque el despliegue de N sitios no es atómico: durante días va a haber
 * sitios en la versión vieja y en la nueva a la vez, y el orquestador tiene que
 * leer a los dos.
 */
export const SUPPORTED_CONTRACTS = ['1.0', '1.1'];
/** True si un lector de este paquete sabe leer esa versión. */
export function isSupportedContract(contract) {
    return SUPPORTED_CONTRACTS.includes(contract);
}
