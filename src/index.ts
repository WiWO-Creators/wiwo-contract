/**
 * Responsabilidad: superficie pública del paquete.
 * Usado por: los sitios que emiten el contrato y wiwo.doom, que lo lee.
 * NO hace: no agrega lógica; solo reexporta.
 */

export {
  WIWO_CONTRACT_VERSION,
  SUPPORTED_CONTRACTS,
  isSupportedContract,
  type SupportedContract,
  type WiwoArticle,
  type WiwoArticlePage,
  type WiwoBlock,
  type WiwoBlockType,
  type WiwoBody,
  type WiwoField,
  type WiwoFieldType,
  type WiwoJson,
  type WiwoManifest,
  type WiwoSiteArticle,
} from './contract.js';

export {
  parseArticlePage,
  parseManifest,
  describeManifestProblem,
} from './parse.js';

export {
  CONTRACT_PATH,
  errorResponse,
  isIsoDate,
  jsonResponse,
  publicOrigin,
} from './http.js';

export {
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
  decodeCursor,
  encodeCursor,
  resolvePageSize,
  sliceByCursor,
  type Slice,
} from './pagination.js';

export {
  WIWO_COMMON_BLOCK_TYPES,
  parseMarkdownBlocks,
  type WiwoCommonBlock,
  type WiwoDivider,
  type WiwoHeading,
  type WiwoList,
  type WiwoParagraph,
  type WiwoQuote,
  type WiwoTable,
} from './blocks.js';

export {
  buildArticleDraft,
  proposeId,
  type WiwoDraftContext,
  type WiwoFieldValue,
  type WiwoFieldValues,
} from './draft.js';

export {
  CORE_FIELD_KEYS,
  WRITE_AUTH_SCHEME,
  parseArticleDraft,
  validateAgainstFields,
  type WiwoArticleDraft,
  type WiwoWriteError,
  type WiwoWriteErrorCode,
  type WiwoWriteResult,
} from './write.js';
