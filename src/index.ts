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
  type WiwoManifest,
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
  CORE_FIELD_KEYS,
  WRITE_AUTH_SCHEME,
  parseArticleDraft,
  validateAgainstFields,
  type WiwoArticleDraft,
  type WiwoWriteError,
  type WiwoWriteErrorCode,
  type WiwoWriteResult,
} from './write.js';
