"use strict";
/**
 * Responsabilidad: superficie pública del paquete.
 * Usado por: los sitios que emiten el contrato y wiwo.doom, que lo lee.
 * NO hace: no agrega lógica; solo reexporta.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.sliceByCursor = exports.resolvePageSize = exports.encodeCursor = exports.decodeCursor = exports.MAX_PAGE_SIZE = exports.DEFAULT_PAGE_SIZE = exports.publicOrigin = exports.jsonResponse = exports.isIsoDate = exports.errorResponse = exports.CONTRACT_PATH = exports.describeManifestProblem = exports.parseManifest = exports.parseArticlePage = exports.isSupportedContract = exports.SUPPORTED_CONTRACTS = exports.WIWO_CONTRACT_VERSION = void 0;
var contract_js_1 = require("./contract.js");
Object.defineProperty(exports, "WIWO_CONTRACT_VERSION", { enumerable: true, get: function () { return contract_js_1.WIWO_CONTRACT_VERSION; } });
Object.defineProperty(exports, "SUPPORTED_CONTRACTS", { enumerable: true, get: function () { return contract_js_1.SUPPORTED_CONTRACTS; } });
Object.defineProperty(exports, "isSupportedContract", { enumerable: true, get: function () { return contract_js_1.isSupportedContract; } });
var parse_js_1 = require("./parse.js");
Object.defineProperty(exports, "parseArticlePage", { enumerable: true, get: function () { return parse_js_1.parseArticlePage; } });
Object.defineProperty(exports, "parseManifest", { enumerable: true, get: function () { return parse_js_1.parseManifest; } });
Object.defineProperty(exports, "describeManifestProblem", { enumerable: true, get: function () { return parse_js_1.describeManifestProblem; } });
var http_js_1 = require("./http.js");
Object.defineProperty(exports, "CONTRACT_PATH", { enumerable: true, get: function () { return http_js_1.CONTRACT_PATH; } });
Object.defineProperty(exports, "errorResponse", { enumerable: true, get: function () { return http_js_1.errorResponse; } });
Object.defineProperty(exports, "isIsoDate", { enumerable: true, get: function () { return http_js_1.isIsoDate; } });
Object.defineProperty(exports, "jsonResponse", { enumerable: true, get: function () { return http_js_1.jsonResponse; } });
Object.defineProperty(exports, "publicOrigin", { enumerable: true, get: function () { return http_js_1.publicOrigin; } });
var pagination_js_1 = require("./pagination.js");
Object.defineProperty(exports, "DEFAULT_PAGE_SIZE", { enumerable: true, get: function () { return pagination_js_1.DEFAULT_PAGE_SIZE; } });
Object.defineProperty(exports, "MAX_PAGE_SIZE", { enumerable: true, get: function () { return pagination_js_1.MAX_PAGE_SIZE; } });
Object.defineProperty(exports, "decodeCursor", { enumerable: true, get: function () { return pagination_js_1.decodeCursor; } });
Object.defineProperty(exports, "encodeCursor", { enumerable: true, get: function () { return pagination_js_1.encodeCursor; } });
Object.defineProperty(exports, "resolvePageSize", { enumerable: true, get: function () { return pagination_js_1.resolvePageSize; } });
Object.defineProperty(exports, "sliceByCursor", { enumerable: true, get: function () { return pagination_js_1.sliceByCursor; } });
