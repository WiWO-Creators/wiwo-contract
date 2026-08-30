# @wiwo/contract

La forma en que un sitio le entrega su contenido al orquestador **wiwo.doom**.

Una sola definición del contrato, instalada por todos. Antes vivía copiada en
cada repositorio: con 100 sitios eso no se sostiene, y un cambio obligaba a
editar 100 repos a mano.

## Qué trae

| | |
|---|---|
| **Tipos** | `WiwoArticle`, `WiwoManifest`, `WiwoBody`, `WiwoField`… |
| **Versión** | `WIWO_CONTRACT_VERSION`, `SUPPORTED_CONTRACTS`, `isSupportedContract` |
| **Lectura** (doom) | `parseManifest`, `parseArticlePage`, `describeManifestProblem` |
| **Respuesta** (sitios) | `publicOrigin`, `jsonResponse`, `errorResponse`, `isIsoDate` |
| **Paginación** (sitios) | `resolvePageSize`, `sliceByCursor`, `encodeCursor` |

Se publica en CommonJS, ESM y tipos: el backend del orquestador es NestJS sobre
CommonJS y los sitios son ESM.

## Instalar

En desarrollo local, desde el repo hermano:

```bash
npm install ../wiwo-contract
```

Para desplegar (Vercel), apuntar a la etiqueta de git — no hace falta registro:

```json
"@wiwo/contract": "github:WiWO-Creators/wiwo-contract#v1.1.0"
```

`prepare` compila al instalar, así que la dependencia por git funciona sin
publicar `dist/`.

## Qué implementa cada sitio

El paquete cubre lo que tiene que ser **idéntico** en todos. Cada sitio agrega
solo lo suyo, que son cuatro archivos:

```
src/lib/wiwo/manifest.ts   qué campos pide este sitio
src/lib/wiwo/articles.ts   traducir su modelo interno al del contrato
src/routes/api/wiwo/v1/manifest.ts    ruta fina
src/routes/api/wiwo/v1/articles.ts    ruta fina
```

## Endpoints

```
GET /api/wiwo/v1/manifest
GET /api/wiwo/v1/articles?since=AAAA-MM-DD&limit=25&cursor=<opaco>
```

`since` filtra por **`updatedAt`**, no por fecha de publicación: una nota vieja
corregida hoy tiene que volver a viajar. Un sitio que no registre ediciones debe
emitir `publishedAt` en `updatedAt`, y entonces el orquestador nunca se entera de
sus correcciones.

`nextCursor` es **opaco**: se devuelve tal cual, no se interpreta.

## Versionado

`SUPPORTED_CONTRACTS` acepta un rango, no una versión exacta, porque el
despliegue de N sitios no es atómico: durante días va a haber sitios en la
versión vieja y en la nueva a la vez.

- **1.1** — paginación por cursor y `updatedAt` con significado propio.
- **1.0** — versión inicial. Se sigue leyendo.

Un cambio incompatible sube la versión **y** se agrega a `SUPPORTED_CONTRACTS`
antes de tocar ningún sitio.

## Desarrollo

```bash
npm run build      # dist/{esm,cjs,types}
npm test           # pruebas sobre el artefacto compilado
npm run typecheck
```

Las pruebas corren contra `dist/`, no contra `src/`: lo que se rompe en
producción es lo que se publica.

## Por qué `dist/` está versionado

Porque el paquete se instala **desde git**, no desde un registro. Ahí el
`dist/` lo tendría que generar el hook `prepare` al instalar, y hay entornos que
bloquean los scripts de instalación — este mismo ya lo hizo. Un despliegue que
falla porque no se compiló una dependencia es peor que tener artefactos en el
repositorio.

Regla: **`npm run build` antes de cada etiqueta**, o se publica una versión con
un `dist/` viejo.
