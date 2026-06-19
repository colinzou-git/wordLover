import assert from "node:assert/strict";

let phraseSafeInputListener = null;
globalThis.document = {
  addEventListener(type, listener, capture) {
    if (type === "input" && capture === true) phraseSafeInputListener = listener;
  },
};

const { sanitizeSpellingInputValue } = await import("../public/spelling.js");

assert.equal(sanitizeSpellingInputValue("of course"), "of course");
assert.equal(sanitizeSpellingInputValue("in terms of"), "in terms of");
assert.equal(sanitizeSpellingInputValue("it’s"), "it's");
assert.equal(sanitizeSpellingInputValue("take off!"), "take off");
assert.equal(typeof phraseSafeInputListener, "function");

const input = {
  id: "spellingInput",
  value: "of ",
  selectionStart: 3,
  setSelectionRange(start, end) {
    this.selectionStart = start;
    this.selectionEnd = end;
  },
};

phraseSafeInputListener({ target: input });
input.value = input.value.replace(/[^A-Za-z0-9-]/g, "");
await new Promise(queueMicrotask);

assert.equal(input.value, "of ");
assert.equal(input.selectionStart, 3);

console.log("PASS spelling input preserves phrase spaces and apostrophes");
