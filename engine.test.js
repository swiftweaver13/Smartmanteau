const assert = require("assert");
const Engine = require("../engine.js");

function allWords(result) {
  return [...result.best, ...result.good, ...result.other].map((item) => item.text);
}

function settings(overrides = {}) {
  return Object.assign({}, Engine.DEFAULTS, overrides, { maxPerSection: 100 });
}

const jonathan = Engine.generate({
  wordA: "Jonathan",
  guideA: "Jon-a-than",
  stressA: 1,
  wordB: "Doris",
  guideB: "Dor-is",
  stressB: 1,
  settings: settings()
});
assert(allWords(jonathan).includes("jonthoris"), "Expected Jonthoris when deletion is enabled");
assert(allWords(jonathan).includes("dronathan"), "Expected Dronathan when metathesis is enabled");

const literalOnly = Engine.generate({
  wordA: "Jonathan",
  guideA: "Jon-a-than",
  stressA: 1,
  wordB: "Doris",
  guideB: "Dor-is",
  stressB: 1,
  settings: settings({
    allowManipulation: false,
    allowDeletion: false,
    allowMetathesis: false,
    allowEquivalentSounds: false
  })
});
assert(!allWords(literalOnly).includes("jonthoris"), "Jonthoris should require manipulation");
assert(allWords(literalOnly).includes("jonaris"), "Expected literal Jonaris");

const sierra = Engine.generate({
  wordA: "Sierra",
  guideA: "Si-er-ra",
  stressA: 2,
  wordB: "Everett",
  guideB: "Ev-er-ett",
  stressB: 1,
  settings: settings()
});
assert(allWords(sierra).includes("sieverett"), "Expected Sieverett");

const joe = Engine.generate({
  wordA: "Joe",
  guideA: "Joe",
  stressA: 1,
  wordB: "George",
  guideB: "George",
  stressB: 1,
  settings: settings()
});
assert(allWords(joe).includes("goe"), "Expected Goe");

const nocturne = Engine.generate({
  wordA: "Nocturne",
  guideA: "Noc-turne",
  stressA: 1,
  wordB: "Daylia",
  guideB: "Day-li-a",
  stressB: 1,
  settings: settings({
    equivalenceGroups: `${Engine.DEFAULTS.equivalenceGroups}\nStory bridge = o/au/aw/ay`
  })
});
assert(allWords(nocturne).includes("daucture"), "Expected Daucture with the custom story bridge group");

console.log("Smartmanteau engine tests passed.");
