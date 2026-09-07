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
GET    /api/wiwo/v1/manifest
GET    /api/wiwo/v1/articles?since=AAAA-MM-DD&limit=25&cursor=<opaco>
POST   /api/wiwo/v1/articles                 publicar o corregir una nota
DELETE /api/wiwo/v1/articles?id=<id>         borrar una nota publicada
POST   /api/wiwo/v1/media                    subir un archivo
GET    /api/wiwo/v1/media/<id>               servirlo
```

Los tres últimos piden la clave del sitio (`Authorization: Bearer`, de
`WIWO_WRITE_TOKEN`) y sólo existen de verdad si el sitio los anuncia en
`capabilities`. El identificador del borrado va en la query y no en la ruta a
propósito: así el borrado llega a un sitio actualizando el paquete, sin agregarle
ningún archivo de ruta.

El borrado alcanza **sólo a lo que el orquestador publicó**. Una nota del archivo
editorial del sitio vive en su código, no en su base: se contesta `404 not_found`
diciéndolo.

`since` filtra por **`updatedAt`**, no por fecha de publicación: una nota vieja
corregida hoy tiene que volver a viajar. Un sitio que no registre ediciones debe
emitir `publishedAt` en `updatedAt`, y entonces el orquestador nunca se entera de
sus correcciones.

`nextCursor` es **opaco**: se devuelve tal cual, no se interpreta.

## Versionado

`SUPPORTED_CONTRACTS` acepta un rango, no una versión exacta, porque el
despliegue de N sitios no es atómico: durante días va a haber sitios en la
versión vieja y en la nueva a la vez.

- **1.2** — la mitad de escritura: publicar, borrar y subir archivos.
- **1.1** — paginación por cursor y `updatedAt` con significado propio.
- **1.0** — versión inicial. Se sigue leyendo.

Lo **opcional** no sube la versión: se anuncia como campo opcional. El borrado
llegó así —`capabilities.delete`— y no como 1.3, porque un sitio que anuncie una
versión que el orquestador todavía no tiene en `SUPPORTED_CONTRACTS` no queda
"sin borrado": queda ilegible entero. Un lector viejo no ve el campo, lo trata
como ausente y no ofrece borrar.

Por lo mismo, `site.audience` —para quién es el sitio— también es opcional y
tampoco subió la versión. Se lee con `audienceOf(manifest)`, que resuelve la
omisión en un solo lugar: sin declaración, `general`. Un valor desconocido
también se lee como `general`, nunca como un error: un sitio más nuevo que quien
lo lee tiene que seguir siendo legible.

Tampoco la sube un cambio que solo toca lo que los sitios implementan de su lado
y no lo que viaja por el cable. `urlFor` pasó a recibir la **nota entera** además
del identificador, y eso no cambió ni una respuesta del protocolo: es la firma de
una función que cada sitio escribe. Los que resuelven la dirección con el id a
secas siguen compilando sin tocarse, porque una función de dos parámetros cumple
un tipo de tres.

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
