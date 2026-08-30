import { test } from "node:test";
import assert from "node:assert/strict";
import {
  parseManifest,
  parseArticlePage,
  describeManifestProblem,
  isSupportedContract,
} from "../dist/esm/index.js";

test("rechaza lo que no es un manifest", () => {
  for (const v of [null, "texto", 42, [], {}, { contract: 1 }]) {
    assert.equal(parseManifest(v), null);
  }
});

test("rechaza el HTML de un SPA disfrazado de respuesta", () => {
  assert.equal(parseManifest("<!DOCTYPE html><html>..."), null);
  assert.equal(parseArticlePage("<!DOCTYPE html>"), null);
});

test("acepta un manifest minimo", () => {
  const m = parseManifest({
    contract: "1.1",
    capabilities: { articles: true, read: true, write: false, media: false },
    format: { fields: [] },
  });
  assert.ok(m);
  assert.equal(describeManifestProblem(m), null);
});

test("explica por que un manifest no sirve", () => {
  const base = { format: { fields: [] } };
  assert.match(
    describeManifestProblem({ ...base, contract: "9.9", capabilities: { articles: true, read: true } }),
    /no sabe leer/,
  );
  assert.match(
    describeManifestProblem({ ...base, contract: "1.1", capabilities: { articles: false, read: true } }),
    /no publica art/,
  );
});

test("tolera versiones vieja y nueva", () => {
  assert.ok(isSupportedContract("1.0"));
  assert.ok(isSupportedContract("1.1"));
  assert.equal(isSupportedContract("2.0"), false);
});

test("descarta filas rotas sin perder las sanas", () => {
  const page = parseArticlePage({
    articles: [
      { id: "a", title: "Buena" },
      { id: "", title: "Sin id" },
      { title: "Sin id tampoco" },
      null,
      { id: "b", title: "Otra buena" },
    ],
  });
  assert.deepEqual(page.articles.map((a) => a.id), ["a", "b"]);
  assert.equal(page.count, 2);
});

test("completa con valores neutros lo que el sitio no informa", () => {
  const [a] = parseArticlePage({ articles: [{ id: "x", title: "T" }] }).articles;
  assert.equal(a.section, null);
  assert.equal(a.author, null);
  assert.equal(a.image, null);
  assert.equal(a.readingMinutes, null);
  assert.deepEqual(a.tags, []);
  assert.deepEqual(a.body, { format: "markdown", markdown: "" });
  assert.deepEqual(a.extra, {});
});

test("updatedAt cae a publishedAt en un sitio 1.0", () => {
  const [a] = parseArticlePage({
    articles: [{ id: "x", title: "T", publishedAt: "2026-08-23" }],
  }).articles;
  assert.equal(a.updatedAt, "2026-08-23");
});

test("un objeto donde va texto no deja '[object Object]'", () => {
  const [a] = parseArticlePage({
    articles: [{ id: "x", title: "T", section: { id: { raro: 1 }, label: {} } }],
  }).articles;
  assert.deepEqual(a.section, { id: "", label: "" });
});

test("conserva las dos formas de cuerpo", () => {
  const p = parseArticlePage({
    articles: [
      { id: "m", title: "M", body: { format: "markdown", markdown: "# Hola" } },
      { id: "b", title: "B", body: { format: "blocks", blocks: [{ type: "paragraph", text: "p" }, { sinTipo: 1 }] } },
    ],
  });
  assert.deepEqual(p.articles[0].body, { format: "markdown", markdown: "# Hola" });
  assert.equal(p.articles[1].body.format, "blocks");
  assert.equal(p.articles[1].body.blocks.length, 1);
});

test("un sitio 1.0 sin paginacion no ofrece cursor", () => {
  assert.equal(parseArticlePage({ articles: [] }).nextCursor, null);
  assert.equal(parseArticlePage({ articles: [], nextCursor: "abc" }).nextCursor, "abc");
});
