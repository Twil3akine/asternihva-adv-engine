import test from "node:test";
import assert from "node:assert/strict";
import { fitDialoguePage } from "../dist/ui/dialogue-paging.js";

const segmenter = new Intl.Segmenter("ja", { granularity: "grapheme" });

function paginate(text, fits) {
  const pages = [];
  let start = 0;
  while (start < text.length) {
    const end = fitDialoguePage(text, start, fits);
    assert.ok(end > start, `page must advance from offset ${start}`);
    assert.ok(end <= text.length, `page end ${end} exceeds text length`);
    pages.push(text.slice(start, end));
    start = end;
    assert.ok(pages.length <= text.length, "pagination must make finite progress");
  }
  return pages;
}

function graphemeBoundaries(text) {
  return new Set([
    0,
    ...[...segmenter.segment(text)].map(({ index }) => index),
    text.length,
  ]);
}

test("a short line that fits returns its full UTF-16 length", () => {
  const text = "短い台詞です。";
  assert.equal(fitDialoguePage(text, 0, () => true), text.length);
});

test("measured capacity splits a line across two pages without loss", () => {
  const text = "春の風。夏の雨。";
  const pages = paginate(text, (candidate) => [...segmenter.segment(candidate)].length <= 4);

  assert.deepEqual(pages, ["春の風。", "夏の雨。"]);
  assert.equal(pages.join(""), text);
});

test("long dialogue advances through three or more pages and reconstructs exactly", () => {
  const text = "春の風が窓を揺らす。遠くで電車の音が聞こえた。彼女は静かに振り返る。";
  const pages = paginate(text, (candidate) => [...segmenter.segment(candidate)].length <= 8);

  assert.ok(pages.length >= 3);
  assert.equal(pages.join(""), text);
});

test("page ends stay on grapheme boundaries for emoji and combining marks", () => {
  const text = "か\u3099👨‍👩‍👧‍👦かなe\u0301🙂";
  const boundaries = graphemeBoundaries(text);
  const pages = paginate(text, (candidate) => [...segmenter.segment(candidate)].length <= 2);
  let offset = 0;

  for (const page of pages) {
    offset += page.length;
    assert.ok(boundaries.has(offset), `offset ${offset} splits a grapheme`);
  }
  assert.equal(pages.join(""), text);
});

test("explicit, repeated, and trailing newlines are preserved", () => {
  const text = "一行目\n\n二行目\n三行目\n";
  const pages = paginate(text, (candidate) => candidate.split("\n").length <= 2);

  assert.ok(pages.length > 1);
  assert.equal(pages.join(""), text);
  assert.equal(pages.join("").match(/\n/g)?.length, text.match(/\n/g)?.length);
});

test("fit decisions use measured width rather than UTF-16 or character count", () => {
  const text = "WWiiああiW";
  const width = (candidate) => [...candidate].reduce((sum, character) =>
    sum + ({ W: 3, i: 1, あ: 2 }[character] ?? 1), 0);
  const pages = paginate(text, (candidate) => width(candidate) <= 6);

  assert.ok(pages.length > 1);
  assert.ok(pages.every((page) => width(page) <= 6));
  assert.equal(pages.join(""), text);
});

test("an unbreakable English word makes progress without losing characters", () => {
  const text = "supercalifragilisticexpialidocious";
  const pages = paginate(text, (candidate) => candidate.length <= 6);

  assert.ok(pages.length > 1);
  assert.equal(pages.join(""), text);
});

test("pagination avoids starting with closing punctuation or ending with opening punctuation when possible", () => {
  const text = "「今日は晴れです。」次は雨でしょう。";
  const pages = paginate(text, (candidate) => [...segmenter.segment(candidate)].length <= 6);
  const closing = /^[、。，．！？）」』】］｝〕〉》]/u;
  const opening = /[「『【［｛〔〈《]$/u;

  assert.ok(pages.length > 1);
  assert.ok(pages.slice(1).every((page) => !closing.test(page)));
  assert.ok(pages.slice(0, -1).every((page) => !opening.test(page)));
  assert.equal(pages.join(""), text);
});
