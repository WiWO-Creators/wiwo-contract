import { test } from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
  encodeCursor,
  decodeCursor,
  resolvePageSize,
  sliceByCursor,
} from "../dist/esm/index.js";

const lista = Array.from({ length: 12 }, (_, i) => ({ id: `n${i}` }));
const idOf = (x) => x.id;

test("resolvePageSize cae al predefinido ante entrada ausente o basura", () => {
  for (const v of [null, undefined, "", "  ", "abc", "0", "-5"]) {
    assert.equal(resolvePageSize(v), DEFAULT_PAGE_SIZE);
  }
});

test("resolvePageSize recorta al maximo en vez de fallar", () => {
  assert.equal(resolvePageSize("999"), MAX_PAGE_SIZE);
  assert.equal(resolvePageSize("7"), 7);
});

test("el cursor va y vuelve", () => {
  assert.equal(decodeCursor(encodeCursor("hola-mundo")), "hola-mundo");
  assert.equal(decodeCursor("!!!no-es-base64!!!"), null);
});

test("recorre la lista completa sin repetir ni saltear", () => {
  const vistos = [];
  let cursor = null;
  let vueltas = 0;

  do {
    const { items, nextCursor } = sliceByCursor(lista, idOf, 5, cursor);
    vistos.push(...items.map(idOf));
    cursor = nextCursor;
    vueltas++;
    assert.ok(vueltas < 10, "no debe ciclar");
  } while (cursor);

  assert.deepEqual(vistos, lista.map(idOf));
  assert.equal(vueltas, 3);
});

test("la ultima pagina no ofrece cursor", () => {
  const { items, nextCursor } = sliceByCursor(lista, idOf, 50, null);
  assert.equal(items.length, 12);
  assert.equal(nextCursor, null);
});

test("un cursor que ya no existe reinicia en vez de fallar", () => {
  const { items } = sliceByCursor(lista, idOf, 3, encodeCursor("borrada"));
  assert.deepEqual(items.map(idOf), ["n0", "n1", "n2"]);
});

test("una lista vacia no ofrece cursor", () => {
  assert.deepEqual(sliceByCursor([], idOf, 5, null), { items: [], nextCursor: null });
});
