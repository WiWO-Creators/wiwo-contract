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
 * 1.1 agregó paginación en el listado y `updatedAt` con significado propio.
 * 1.2 agregó la mitad de ESCRITURA: publicar desde el orquestador (ver write.ts).
 *
 * Los tres cambios son aditivos: un lector de 1.0 sigue funcionando contra un
 * sitio 1.2 porque ignora lo que no conoce, y un sitio que no acepta escrituras
 * lo dice en `capabilities.write` sin dejar de ser 1.2.
 */
export const WIWO_CONTRACT_VERSION = '1.2';

/**
 * Versiones que un lector de esta versión del paquete sabe interpretar.
 *
 * Existe porque el despliegue de N sitios no es atómico: durante días va a haber
 * sitios en la versión vieja y en la nueva a la vez, y el orquestador tiene que
 * leer a los dos.
 */
export const SUPPORTED_CONTRACTS = ['1.0', '1.1', '1.2'] as const;

export type SupportedContract = (typeof SUPPORTED_CONTRACTS)[number];

/** True si un lector de este paquete sabe leer esa versión. */
export function isSupportedContract(contract: string): boolean {
  return (SUPPORTED_CONTRACTS as readonly string[]).includes(contract);
}

/**
 * Tipo de un campo del formato. El orquestador arma el formulario con esto, así
 * que no puede haber campos cuyo tipo no esté acá.
 */
export type WiwoFieldType =
  | 'text'
  | 'longtext'
  | 'markdown'
  | 'blocks'
  | 'enum'
  | 'image'
  | 'tags'
  | 'list'
  | 'pairs'
  | 'number'
  | 'boolean';

/** Un campo tal como lo pide un sitio concreto. */
export type WiwoField = {
  key: string;
  /** Como lo llama ese sitio. Es lo que ve quien escribe en el orquestador. */
  label: string;
  type: WiwoFieldType;
  required: boolean;
  /** Límite real del sitio. Ausente = sin límite. */
  maxLength?: number;
  /** Solo en type "enum": los únicos valores que el sitio acepta. */
  options?: { value: string; label: string }[];
  /**
   * Solo en type "pairs": cómo se llama cada mitad del par. Sin esto el
   * orquestador tendría que saber de antemano que un par es pregunta/respuesta.
   */
  itemLabels?: { key: string; value: string };
  /** Cuántos elementos espera el sitio en type "list", "pairs" o "tags". */
  itemCount?: { min?: number; max?: number };
  /** Regla editorial que el orquestador muestra junto al campo. */
  hint?: string;
};

/**
 * Un bloque del cuerpo. El tipo es abierto a propósito.
 *
 * El orquestador no interpreta bloques: los transporta tal cual. Qué significa
 * cada tipo lo declara el manifest en `format.blockTypes`, así un sitio puede
 * tener un bloque "cifra" o "gráfico" sin que haya que tocar este paquete.
 */
export type WiwoBlock = { type: string } & Record<string, unknown>;

/** Un tipo de bloque, declarado para que el orquestador pueda editar el cuerpo. */
export type WiwoBlockType = {
  type: string;
  label: string;
  hint?: string;
};

/**
 * El cuerpo de una nota, en la forma en que el sitio lo guarda.
 *
 * Son dos formas reales, no una hipótesis. Convertir una en otra haría perder
 * información al devolver la nota para publicarla.
 */
export type WiwoBody =
  | { format: 'markdown'; markdown: string }
  | { format: 'blocks'; blocks: WiwoBlock[] };

/** Una nota publicada, tal como sale al cable. */
export type WiwoArticle = {
  /** Identificador dentro de su sitio, no del orquestador. */
  id: string;
  url: string;
  title: string;
  /** Resumen corto. Cada sitio lo llama distinto: bajada, dek, extracto. */
  summary: string;
  /** Null en sitios que no agrupan por secciones. */
  section: { id: string; label: string } | null;
  /**
   * Firma. Solo `name` es seguro: hay sitios con ficha de autor y sitios que
   * firman con una línea de texto.
   */
  author: { name: string; slug?: string; role?: string } | null;
  /** ISO 8601. Puede ser solo fecha si el sitio no guarda hora. */
  publishedAt: string;
  /**
   * ISO 8601. Cuándo se editó por última vez.
   *
   * Es el campo del que depende toda la sincronización incremental: `since`
   * filtra por acá, no por la fecha de publicación, para que una nota vieja que
   * se corrigió hoy vuelva a viajar. Un sitio que no registre ediciones debe
   * emitir `publishedAt`, y entonces el orquestador nunca se entera de sus
   * correcciones — por eso conviene registrarlas.
   */
  updatedAt: string;
  /** Null si el sitio no lo calcula. */
  readingMinutes: number | null;
  image: { url: string; alt: string } | null;
  tags: string[];
  featured: boolean;
  /** Orden editorial dentro de una misma fecha; menor primero. Null si no aplica. */
  rank: number | null;
  body: WiwoBody;
  seo: {
    title: string | null;
    description: string | null;
    tldr: string[];
    faq: { question: string; answer: string }[];
  };
  /**
   * Campos propios del sitio que el núcleo no cubre. El orquestador los
   * transporta sin interpretarlos, para no perderlos al republicar.
   */
  extra: Record<string, unknown>;
};

/**
 * Qué es un sitio y qué acepta.
 *
 * Es lo primero que pide el orquestador. Reemplaza a cualquier intento de
 * adivinar la plataforma: el sitio se declara, no se lo olfatea.
 */
export type WiwoManifest = {
  contract: string;
  site: {
    name: string;
    url: string;
    /** Código BCP 47. */
    language: string;
  };
  /**
   * Qué se puede hacer con este sitio. Una página conectada puede no publicar
   * artículos en absoluto (`articles: false`), y entonces el orquestador no
   * debe ofrecerla como destino.
   */
  capabilities: {
    articles: boolean;
    read: boolean;
    write: boolean;
    media: boolean;
  };
  format: {
    id: string;
    label: string;
    fields: WiwoField[];
    /** Vacío cuando el cuerpo del sitio no es por bloques. */
    blockTypes: WiwoBlockType[];
  };
  counts: { articles: number };
  /** ISO 8601. Cuándo se armó esta respuesta. */
  generatedAt: string;
};

/** Una página del listado de notas. */
export type WiwoArticlePage = {
  articles: WiwoArticle[];
  /** Cuántas notas trae ESTA página, no el total del sitio. */
  count: number;
  /**
   * Con qué seguir pidiendo. Null cuando no queda nada.
   *
   * Es opaco: el orquestador lo devuelve tal cual y no debe interpretarlo, para
   * que un sitio pueda cambiar cómo pagina sin romper a sus lectores.
   */
  nextCursor: string | null;
  generatedAt: string;
};
