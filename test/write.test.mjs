import { test } from "node:test";
import assert from "node:assert/strict";
import {
  parseArticleDraft,
  validateAgainstFields,
  isSupportedContract,
  WIWO_CONTRACT_VERSION,
} from "../dist/esm/index.js";

/** Un borrador mínimo que sí pasa, para partir de algo válido en cada prueba. */
const borrador = () => ({
  title: "Una pieza",
  summary: "La bajada",
  body: { format: "markdown", markdown: "# Hola" },
  extra: {},
});

test("1.2 se declara y se sigue leyendo lo viejo", () => {
  assert.equal(WIWO_CONTRACT_VERSION, "1.2");
  for (const v of ["1.0", "1.1", "1.2"]) assert.ok(isSupportedContract(v));
  assert.equal(isSupportedContract("2.0"), false);
});

test("rechaza lo que no es un borrador", () => {
  for (const v of [null, "texto", 42, [], {}]) {
    assert.equal(parseArticleDraft(v), null);
  }
});

test("exige titulo con contenido, no solo presente", () => {
  assert.equal(parseArticleDraft({ ...borrador(), title: "" }), null);
  assert.equal(parseArticleDraft({ ...borrador(), title: "   " }), null);
  assert.equal(parseArticleDraft({ ...borrador(), title: 42 }), null);
});

test("exige un cuerpo en una de las dos formas del contrato", () => {
  assert.equal(parseArticleDraft({ ...borrador(), body: undefined }), null);
  assert.equal(parseArticleDraft({ ...borrador(), body: { format: "markdown" } }), null);
  assert.equal(parseArticleDraft({ ...borrador(), body: { format: "otra", x: 1 } }), null);
  assert.ok(parseArticleDraft({ ...borrador(), body: { format: "blocks", blocks: [] } }));
});

test("el id es opcional pero si viene tiene que ser texto", () => {
  assert.ok(parseArticleDraft(borrador()));
  assert.ok(parseArticleDraft({ ...borrador(), id: "mi-slug" }));
  assert.equal(parseArticleDraft({ ...borrador(), id: 7 }), null);
});

test("marca los obligatorios que faltan, por clave", () => {
  const campos = [
    { key: "title", label: "Título", type: "text", required: true },
    { key: "rubric", label: "Rúbrica", type: "text", required: true },
    { key: "country", label: "País", type: "text", required: false },
  ];
  const errores = validateAgainstFields(parseArticleDraft(borrador()), campos);
  assert.deepEqual(Object.keys(errores), ["rubric"]);
  assert.match(errores.rubric, /Rúbrica/);
});

test("busca los campos propios del sitio en extra", () => {
  const campos = [{ key: "rubric", label: "Rúbrica", type: "text", required: true }];
  const conRubrica = { ...borrador(), extra: { rubric: "La Polis" } };
  assert.deepEqual(validateAgainstFields(parseArticleDraft(conRubrica), campos), {});
});

test("un enum solo admite lo que el manifest lista", () => {
  const campos = [{
    key: "section", label: "Sección", type: "enum", required: true,
    options: [{ value: "polis", label: "La Polis" }],
  }];
  const malo = { ...borrador(), extra: { section: "deportes" } };
  assert.ok(validateAgainstFields(parseArticleDraft(malo), campos).section);
  const bueno = { ...borrador(), extra: { section: "polis" } };
  assert.deepEqual(validateAgainstFields(parseArticleDraft(bueno), campos), {});
});

test("un enum sin opciones no bloquea la publicacion", () => {
  // Manifest incompleto: no hay contra qué comparar. Rechazar todo dejaría el
  // sitio imposible de publicar por un error de quien lo declaró.
  const campos = [{ key: "section", label: "Sección", type: "enum", required: true }];
  const draft = { ...borrador(), extra: { section: "lo-que-sea" } };
  assert.deepEqual(validateAgainstFields(parseArticleDraft(draft), campos), {});
});

test("un opcional vacio no se juzga, pero uno con valor si", () => {
  const campos = [{ key: "readingMinutes", label: "Minutos", type: "number", required: false }];
  assert.deepEqual(validateAgainstFields(parseArticleDraft(borrador()), campos), {});
  const malo = { ...borrador(), extra: { readingMinutes: "cinco" } };
  assert.ok(validateAgainstFields(parseArticleDraft(malo), campos).readingMinutes);
});

test("el cero y el false cuentan como rellenados", () => {
  // Trampa clásica: tratarlos como vacíos haría imposible publicar una pieza
  // con rank 0 o featured en false.
  const campos = [
    { key: "rank", label: "Orden", type: "number", required: true },
    { key: "featured", label: "Destacada", type: "boolean", required: true },
  ];
  const draft = { ...borrador(), extra: { rank: 0, featured: false } };
  assert.deepEqual(validateAgainstFields(parseArticleDraft(draft), campos), {});
});

test("un enum del nucleo se compara desenvuelto, no como objeto", () => {
  // La regresión que motivó la tabla EN_EL_NUCLEO: el manifest declara
  // `section` como lista de identificadores, pero la pieza lleva
  // `section: { id, label }`. Comparar el objeto rechazaba un valor correcto.
  const campos = [{
    key: "section", label: "Sección", type: "enum", required: true,
    options: [{ value: "polis", label: "La Polis" }],
  }];
  const draft = {
    ...borrador(),
    section: { id: "polis", label: "La Polis" },
  };
  assert.deepEqual(validateAgainstFields(parseArticleDraft(draft), campos), {});
});

test("lee los campos del nucleo que viajan envueltos", () => {
  const campos = [
    { key: "author", label: "Firma", type: "text", required: true },
    { key: "image", label: "Lámina", type: "image", required: true },
    { key: "imageAlt", label: "Alt", type: "text", required: true },
  ];
  const draft = {
    ...borrador(),
    author: { name: "Redacción" },
    image: { url: "/x.jpg", alt: "una lámina" },
  };
  assert.deepEqual(validateAgainstFields(parseArticleDraft(draft), campos), {});
});

test("un cuerpo sin una palabra cuenta como vacio", () => {
  // El envoltorio del cuerpo nunca está vacío; hay que mirar su contenido.
  const campos = [{ key: "body", label: "Cuerpo", type: "markdown", required: true }];
  const vacio = { ...borrador(), body: { format: "markdown", markdown: "   " } };
  assert.ok(validateAgainstFields(parseArticleDraft(vacio), campos).body);
  assert.deepEqual(validateAgainstFields(parseArticleDraft(borrador()), campos), {});
});

test("extra respalda al nucleo cuando el nucleo no trae nada", () => {
  const campos = [{ key: "readingMinutes", label: "Minutos", type: "number", required: true }];
  const draft = { ...borrador(), extra: { readingMinutes: 7 } };
  assert.deepEqual(validateAgainstFields(parseArticleDraft(draft), campos), {});
});
