import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildArticleDraft,
  proposeId,
  parseMarkdownBlocks,
  validateAgainstFields,
} from "../dist/esm/index.js";

/**
 * Lo que se comprueba acá es la simetría: que lo que arma `buildArticleDraft`
 * sea exactamente lo que `validateAgainstFields` sabe leer. Cada prueba con dos
 * mitades —armar y validar— cubre una divergencia que ya ocurrió.
 */

const contexto = { publishedAt: "2026-08-31" };

test("propone un identificador sin acentos ni signos", () => {
  assert.equal(proposeId("Políticas públicas: ¿y ahora?"), "politicas-publicas-y-ahora");
  assert.equal(proposeId("   "), "");
});

test("un sitio que pide bloques recibe bloques, no Markdown", () => {
  const campos = [{ key: "body", label: "Cuerpo", type: "blocks", required: true }];
  const draft = buildArticleDraft(
    campos,
    { body: "## Un subtitulo\n\nUn parrafo.\n\n> Una cita" },
    contexto,
  );

  assert.equal(draft.body.format, "blocks");
  assert.deepEqual(draft.body.blocks, [
    { type: "heading", text: "Un subtitulo" },
    { type: "paragraph", text: "Un parrafo." },
    { type: "quote", text: "Una cita" },
  ]);
});

test("un sitio que pide Markdown lo recibe sin tocar", () => {
  const campos = [{ key: "body", label: "Cuerpo", type: "longtext", required: true }];
  const draft = buildArticleDraft(campos, { body: "## Titulo\n\nTexto." }, contexto);

  assert.equal(draft.body.format, "markdown");
  assert.equal(draft.body.markdown, "## Titulo\n\nTexto.");
});

test("texto vacio no inventa bloques", () => {
  assert.deepEqual(parseMarkdownBlocks("   \n\n  "), []);
});

test("una firma de lista cerrada viaja por slug y la valida el sitio", () => {
  const campos = [
    {
      key: "author",
      label: "Autor",
      type: "enum",
      required: true,
      options: [{ value: "ana-rios", label: "Ana Ríos" }],
    },
  ];
  const draft = buildArticleDraft(campos, { author: "ana-rios" }, contexto);

  assert.equal(draft.author.slug, "ana-rios");
  assert.equal(draft.author.name, "Ana Ríos");
  assert.deepEqual(validateAgainstFields(draft, campos), {});
});

test("una firma editorial libre sigue viajando por nombre", () => {
  const campos = [{ key: "author", label: "Firma", type: "text", required: true }];
  const draft = buildArticleDraft(campos, { author: "Redacción Politarca" }, contexto);

  assert.equal(draft.author.name, "Redacción Politarca");
  assert.equal(draft.author.slug, undefined);
  assert.deepEqual(validateAgainstFields(draft, campos), {});
});

test("la capa SEO va en seo y no se duplica en extra", () => {
  const campos = [
    { key: "seoTitle", label: "Título para buscadores", type: "text", required: true },
    { key: "tldr", label: "Lo que hay que saber", type: "list", required: true },
    { key: "faq", label: "Preguntas frecuentes", type: "pairs", required: true },
    { key: "rubric", label: "Rúbrica", type: "text", required: false },
  ];
  const draft = buildArticleDraft(
    campos,
    {
      seoTitle: "Titulo corto",
      tldr: ["uno", "dos"],
      faq: [{ key: "¿Y?", value: "Pues eso." }],
      rubric: "El Erario",
    },
    contexto,
  );

  assert.equal(draft.seo.title, "Titulo corto");
  assert.deepEqual(draft.seo.tldr, ["uno", "dos"]);
  assert.deepEqual(draft.seo.faq, [{ question: "¿Y?", answer: "Pues eso." }]);
  // Solo lo propio del sitio queda en extra.
  assert.deepEqual(draft.extra, { rubric: "El Erario" });
  assert.deepEqual(validateAgainstFields(draft, campos), {});
});

test("la seccion viaja envuelta y se valida por su identificador", () => {
  const campos = [
    {
      key: "section",
      label: "Sección",
      type: "enum",
      required: true,
      options: [{ value: "polis", label: "La Polis" }],
    },
  ];
  const draft = buildArticleDraft(campos, { section: "polis" }, contexto);

  assert.deepEqual(draft.section, { id: "polis", label: "La Polis" });
  assert.deepEqual(validateAgainstFields(draft, campos), {});
});

test("lo que no se escribio se reporta como faltante, no se inventa", () => {
  const campos = [
    { key: "title", label: "Título", type: "text", required: true },
    { key: "summary", label: "Bajada", type: "longtext", required: true },
    { key: "tags", label: "Etiquetas", type: "tags", required: true },
  ];
  const draft = buildArticleDraft(campos, { title: "Solo el titulo" }, contexto);

  assert.deepEqual(validateAgainstFields(draft, campos), {
    summary: 'Falta "Bajada".',
    tags: 'Falta "Etiquetas".',
  });
});

test("un cuerpo en la forma que el sitio no dibuja se rechaza", () => {
  const pideBloques = [{ key: "body", label: "Cuerpo", type: "blocks", required: true }];
  const pideMarkdown = [{ key: "body", label: "Cuerpo", type: "markdown", required: true }];

  const enMarkdown = { title: "t", body: { format: "markdown", markdown: "Hola" } };
  const enBloques = { title: "t", body: { format: "blocks", blocks: [{ type: "paragraph", text: "Hola" }] } };

  assert.deepEqual(validateAgainstFields(enMarkdown, pideBloques), {
    body: '"Cuerpo" tiene que venir en bloques.',
  });
  assert.deepEqual(validateAgainstFields(enBloques, pideMarkdown), {
    body: '"Cuerpo" tiene que venir en Markdown.',
  });
  assert.deepEqual(validateAgainstFields(enBloques, pideBloques), {});
  assert.deepEqual(validateAgainstFields(enMarkdown, pideMarkdown), {});
});

test("el lector de Markdown reconoce lista, tabla y separador", () => {
  assert.deepEqual(parseMarkdownBlocks("- uno\n- dos"), [
    { type: "list", ordered: false, items: ["uno", "dos"] },
  ]);
  assert.deepEqual(parseMarkdownBlocks("1. uno\n2. dos"), [
    { type: "list", ordered: true, items: ["uno", "dos"] },
  ]);
  assert.deepEqual(
    parseMarkdownBlocks("| a | b |\n| --- | --- |\n| 1 | 2 |"),
    [{ type: "table", head: ["a", "b"], rows: [["1", "2"]] }],
  );
  assert.deepEqual(parseMarkdownBlocks("---"), [{ type: "divider" }]);
});

test("un parrafo cortado a lo ancho vuelve a ser una sola linea", () => {
  assert.deepEqual(parseMarkdownBlocks("una linea\ny la siguiente"), [
    { type: "paragraph", text: "una linea y la siguiente" },
  ]);
});

test("el Markdown en linea se conserva dentro del texto", () => {
  assert.deepEqual(parseMarkdownBlocks("con **negrita** y *cursiva*"), [
    { type: "paragraph", text: "con **negrita** y *cursiva*" },
  ]);
});
