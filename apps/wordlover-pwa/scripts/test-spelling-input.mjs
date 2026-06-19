import assert from "node:assert/strict";
import { sanitizeSpellingInputValue } from "../public/spelling.js";

assert.equal(sanitizeSpellingInputValue("of course"), "of course");
assert.equal(sanitizeSpellingInputValue("in terms of"), "in terms of");
assert.equal(sanitizeSpellingInputValue("it’s"), "it's");
assert.equal(sanitizeSpellingInputValue("take off!"), "take off");

console.log("PASS spelling input preserves phrase spaces and apostrophes");
