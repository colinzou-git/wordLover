import assert from "node:assert/strict";
import { appendSupplementHint, MAX_STUDY_SUPPLEMENT_LENGTH, quizMeaningWithSupplement, savedSupplementToStudySnapshot } from "../public/study-supplements.js";

const record = { entry: { schemaVersion: 1, provider: { id: "youdao", label: "Youdao" }, sourceUrl: "https://dict.youdao.com/result?word=charge&lang=en", retrievedAt: "2026-07-14T00:00:00.000Z", chineseDefinitions: [{ text: "费用", partOfSpeech: "n." }, { text: "费用" }, { text: "使承担责任", domain: "law" }, { text: "x".repeat(MAX_STUDY_SUPPLEMENT_LENGTH + 1) }], englishDefinitions: [], examples: [{ sentence: "charge it" }], phrases: [{ phrase: "in charge" }], synonyms: ["bill"] } };
const snapshot = savedSupplementToStudySnapshot(record, { localMeanings: ["收费"], targetTerm: "charge" });
assert.deepEqual(snapshot.meanings.map((item) => item.text), ["费用", "使承担责任"]);
assert.equal(snapshot.meanings[0].partOfSpeech, "n."); assert.equal(snapshot.meanings[1].domain, "law");
assert.equal(JSON.stringify(snapshot).includes("charge it"), false, "examples and phrases never enter study snapshots");
assert.equal(quizMeaningWithSupplement("收费", snapshot), "收费 · 费用");
assert.equal(appendSupplementHint("收费", snapshot), "收费 · 费用 · 使承担责任");
assert.equal(savedSupplementToStudySnapshot({ entry: { ...record.entry, chineseDefinitions: [], englishDefinitions: [{ text: "to charge or charging a CHARGE" }] } }, { targetTerm: "charge" }).meanings[0].text, "to ____ or ____ a ____");
assert.equal(savedSupplementToStudySnapshot(record, { localMeanings: ["费用", "使承担责任"] }), null, "exact local duplicates are removed");
assert.equal(savedSupplementToStudySnapshot({ entry: { provider: { id: "other" } } }), null);
console.log("study supplement tests passed");
