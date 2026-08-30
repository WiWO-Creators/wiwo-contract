import { rmSync, mkdirSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";

/**
 * Responsabilidad: compilar el paquete a CommonJS, ESM y tipos.
 * Usado por: `npm run build`, y por `prepare` al instalarlo desde git.
 * NO hace: no publica ni versiona.
 *
 * Hacen falta los dos formatos porque los consumidores no coinciden: el backend
 * del orquestador es NestJS sobre CommonJS y los sitios son ESM. Publicar uno
 * solo obliga al otro a hacer malabares en tiempo de ejecución.
 */

// Se invoca el tsc instalado por su entrada de Node y no por `npx`: en Windows
// el ejecutable es un .cmd y execFile no puede lanzarlo sin shell.
const require = createRequire(import.meta.url);
const tsc = require.resolve("typescript/bin/tsc");

const run = (config) =>
  execFileSync(process.execPath, [tsc, "-p", config], { stdio: "inherit" });

rmSync("dist", { recursive: true, force: true });

run("tsconfig.esm.json");
run("tsconfig.cjs.json");
run("tsconfig.types.json");

// El package.json raíz declara "type": "module", así que sin este marcador Node
// leería los .js de dist/cjs como ESM y fallaría al primer `require`.
mkdirSync("dist/cjs", { recursive: true });
writeFileSync(
  "dist/cjs/package.json",
  JSON.stringify({ type: "commonjs" }, null, 2) + "\n",
);

console.log("wiwo-contract compilado: dist/{esm,cjs,types}");
