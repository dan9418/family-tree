const assert = require("node:assert/strict");
const FamilyLayout = require("./family-layout");

// Fictional fixture independent of the private, locally edited JSON file.
const data = {
  root: "Alex Example",
  parents: {
    "Alex Example": ["Robin Example", "Casey Sample"],
    "Blair Example": ["Robin Example", "Casey Sample"],
    "Robin Example": ["Morgan Example", "Taylor Example"],
    "Jamie Example": ["Morgan Example", "Taylor Example"],
    "Casey Sample": ["Avery Sample", "Jordan Sample"],
    "Riley Sample": ["Avery Sample", "Jordan Sample"],
    "Quinn Example": ["Jamie Example", "Skyler Demo"],
    "Drew Demo": ["Quinn Example", "Reese Demo"],
    "Parker Sample": ["Riley Sample", "Finley Demo"]
  },
  partners: [
    ["Robin Example", "Casey Sample"],
    ["Morgan Example", "Taylor Example"],
    ["Avery Sample", "Jordan Sample"],
    ["Jamie Example", "Skyler Demo"],
    ["Quinn Example", "Reese Demo"],
    ["Riley Sample", "Finley Demo"],
    ["Blair Example", "Rowan Demo"]
  ]
};

const model = FamilyLayout.buildLayoutModel(data);
assert.equal(model.people.size, 17);
const rows = model.orderedGenerations.flatMap(([, people]) => people);
assert.equal(rows.length, new Set(rows).size);
assert.deepEqual(new Set(rows), model.people);
for (const [child, parents] of Object.entries(data.parents)) {
  for (const parent of parents) {
    assert.equal(model.generations.get(parent), model.generations.get(child) + 1);
  }
}
assert.equal(model.generations.get("Alex Example"), 0);
assert.equal(model.generations.get("Drew Demo"), -1);
assert.equal(model.generations.get("Rowan Demo"), 0);

const hybrid = FamilyLayout.buildHybridTreeModel(data);
assert.deepEqual(new Set(hybrid.rootFamilies.map(f => FamilyLayout.getFamilyKey(f.parents))), new Set([
  FamilyLayout.getFamilyKey(["Morgan Example", "Taylor Example"]),
  FamilyLayout.getFamilyKey(["Avery Sample", "Jordan Sample"])
]));
assert.equal(hybrid.familyGroups.length, 6);
for (const family of hybrid.familyGroups) {
  const expected = Object.entries(data.parents)
    .filter(([, parents]) => FamilyLayout.getFamilyKey(parents) === FamilyLayout.getFamilyKey(family.parents))
    .map(([child]) => child);
  assert.deepEqual(new Set(family.children), new Set(expected));
  assert.equal(hybrid.familyMap.get(FamilyLayout.getFamilyKey(family.parents)), family);
}

for (const [first, second] of data.partners) {
  assert.ok(hybrid.partnerMap.get(first).includes(second));
  assert.ok(hybrid.partnerMap.get(second).includes(first));
}

const family = hybrid.familyMap.get(FamilyLayout.getFamilyKey(["Robin Example", "Casey Sample"]));
const boxes = new Map([...family.parents, ...family.children].map((name, index) => {
  const left = index * 220;
  const top = index < 2 ? 0 : 180;
  return [name, { left, right: left + 180, top, bottom: top + 90,
    width: 180, height: 90, centerX: left + 90, centerY: top + 45 }];
}));
const segments = FamilyLayout.buildParentChildSegments(family, boxes);
assert.deepEqual(segments.filter(s => s.type === "parent-spoke").map(s => s.person), family.parents);
assert.deepEqual(segments.filter(s => s.type === "child-spoke").map(s => s.person), family.children);
for (const type of ["parent-bus", "child-bus", "family-spine"]) {
  assert.equal(segments.filter(s => s.type === type).length, 1);
}

console.log("All family layout tests passed (fictional data only).");
