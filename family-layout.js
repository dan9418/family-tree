(function (root, factory) {
  const api = factory();

  if (typeof module === "object" && module.exports) {
    module.exports = api;
  } else {
    root.FamilyLayout = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : window, function () {
  function buildLayoutModel(data) {
    const people = collectPeople(data);
    const generations = assignGenerations(data, people);

    return {
      people,
      generations,
      orderedGenerations: orderGenerations(generations, data),
      familyGroups: groupChildrenByParents(data),
      partnerPairs: getPartnerPairs(data)
    };
  }

  function buildHybridTreeModel(data) {
    const people = collectPeople(data);
    const familyGroups = groupChildrenByParents(data);
    const familyMap = new Map(familyGroups.map((family) => [getFamilyKey(family.parents), family]));
    const generations = assignGenerations(data, people);
    const priorities = computeLayoutPriorities(data, generations);
    const rootFamilies = familyGroups
      .filter((family) => family.parents.every((parent) => !data.parents?.[parent]))
      .sort((a, b) => average(a.parents.map((parent) => priorities.get(parent) ?? 0)) - average(b.parents.map((parent) => priorities.get(parent) ?? 0)));

    return {
      familyGroups,
      familyMap,
      people,
      rootFamilies,
      partnerMap: buildPartnerMap(data, { inferCoparents: false })
    };
  }

  function collectPeople(data) {
    const people = new Set();

    if (data.root) {
      people.add(data.root);
    }

    Object.entries(data.parents || {}).forEach(([child, parents]) => {
      people.add(child);
      parents.forEach((parent) => people.add(parent));
    });

    (data.partners || []).forEach((partners) => {
      partners.forEach((partner) => people.add(partner));
    });

    Object.keys(data.details || {}).forEach((name) => people.add(name));

    return people;
  }

  function assignGenerations(data, people) {
    const generations = new Map();
    const partnerMap = buildPartnerMap(data, { inferCoparents: true });

    if (data.root) {
      generations.set(data.root, 0);
    }

    let changed = true;
    let passes = 0;

    while (changed && passes < people.size * 4) {
      changed = false;
      passes += 1;

      Object.entries(data.parents || {}).forEach(([child, parents]) => {
        const childGeneration = generations.get(child);

        if (childGeneration !== undefined) {
          parents.forEach((parent) => {
            changed = setGeneration(generations, parent, childGeneration + 1) || changed;
          });
        }

        const parentGenerations = parents
          .map((parent) => generations.get(parent))
          .filter((generation) => generation !== undefined);

        if (parentGenerations.length && !generations.has(child)) {
          changed = setGeneration(generations, child, Math.max(...parentGenerations) - 1) || changed;
        }
      });

      [...partnerMap.entries()].forEach(([person, partners]) => {
        const generation = generations.get(person);

        if (generation === undefined) return;

        partners.forEach((partner) => {
          if (!generations.has(partner)) {
            generations.set(partner, generation);
            changed = true;
          }
        });
      });
    }

    people.forEach((person) => {
      if (!generations.has(person)) {
        generations.set(person, 0);
      }
    });

    return generations;
  }

  function setGeneration(generations, person, generation) {
    const existing = generations.get(person);

    if (existing === undefined || generation > existing) {
      generations.set(person, generation);
      return true;
    }

    return false;
  }

  function orderGenerations(generations, data) {
    const byGeneration = new Map();
    const priorities = computeLayoutPriorities(data, generations);
    const lineage = collectRootLineage(data);
    const branchInfo = computeBranchInfo(data);

    [...generations.entries()].forEach(([person, generation]) => {
      if (!byGeneration.has(generation)) {
        byGeneration.set(generation, []);
      }

      byGeneration.get(generation).push(person);
    });

    return [...byGeneration.entries()]
      .sort(([a], [b]) => b - a)
      .map(([generation, names]) => [generation, orderPeople(names, data, { branchInfo, lineage, priorities })]);
  }

  function orderPeople(names, data, options = {}) {
    const { branchInfo = null, priorities = null, lineage = new Set() } = options;
    const partnerMap = buildPartnerMap(data, { inferCoparents: true });
    const seen = new Set();
    const ordered = [];

    names
      .slice()
      .sort((a, b) => comparePeople(a, b, data, priorities, lineage, branchInfo))
      .forEach((name) => {
      if (seen.has(name)) return;

        ordered.push(name);
        seen.add(name);

        const partner = (partnerMap.get(name) || []).find((candidate) => {
        if (!names.includes(candidate) || seen.has(candidate)) return false;
        if (!priorities || !branchInfo) return true;

        return getSide(branchInfo, name) === getSide(branchInfo, candidate)
          && Math.abs((priorities.get(name) ?? 0) - (priorities.get(candidate) ?? 0)) < 0.001;
      });

        if (partner) {
          ordered.push(partner);
          seen.add(partner);
        }
      });

    return ordered;
  }

  function comparePeople(a, b, data, priorities, lineage, branchInfo = null) {
    const sideA = getSide(branchInfo, a);
    const sideB = getSide(branchInfo, b);

    if (sideA !== sideB) {
      return sideSortValue(sideA) - sideSortValue(sideB);
    }

    const lineageA = lineage.has(a);
    const lineageB = lineage.has(b);

    if (lineageA !== lineageB && sideA !== 0) {
      return sideA < 0
        ? (lineageA ? 1 : -1)
        : (lineageA ? -1 : 1);
    }

    const priorityA = priorities?.get(a) ?? Number.MAX_SAFE_INTEGER;
    const priorityB = priorities?.get(b) ?? Number.MAX_SAFE_INTEGER;

    if (priorityA !== priorityB) {
      return priorityA - priorityB;
    }

    if (a === data.root) return -1;
    if (b === data.root) return 1;

    const hasParentsA = Boolean(data.parents?.[a]);
    const hasParentsB = Boolean(data.parents?.[b]);

    if (hasParentsA !== hasParentsB) {
      return hasParentsA ? -1 : 1;
    }

    return a.localeCompare(b);
  }

  function getSide(branchInfo, person) {
    return branchInfo?.get(person)?.side ?? 0;
  }

  function sideSortValue(side) {
    if (side < 0) return 0;
    if (side > 0) return 2;
    return 1;
  }

  function computeBranchInfo(data) {
    const info = new Map();
    const root = data.root;
    const rootParents = data.parents?.[root] || [];
    const partnerMap = buildPartnerMap(data, { inferCoparents: false });
    const rootSiblings = new Set(root ? findSiblings(root, data) : []);

    rootSiblings.forEach((person) => setSide(info, person, 0));
    [...rootSiblings].forEach((person) => {
      (partnerMap.get(person) || []).forEach((partner) => setSide(info, partner, 0));
    });

    rootParents.forEach((parent, index) => {
      const side = rootParents.length === 1 ? 0 : index === 0 ? -1 : 1;
      setSide(info, parent, side, true);
      collectAncestors(parent, data).forEach((ancestor) => setSide(info, ancestor, side));
      findSiblings(parent, data).forEach((sibling) => setSide(info, sibling, side));
    });

    let changed = true;
    let passes = 0;
    const people = collectPeople(data);

    while (changed && passes < people.size * 4) {
      changed = false;
      passes += 1;

      Object.entries(data.parents || {}).forEach(([child, parents]) => {
        if (info.has(child)) return;

        const parentSides = [...new Set(
          parents
            .map((parent) => info.get(parent)?.side)
            .filter((side) => side !== undefined && side !== 0)
        )];

        if (parentSides.length === 1) {
          info.set(child, { side: parentSides[0] });
          changed = true;
        }
      });

      [...partnerMap.entries()].forEach(([person, partners]) => {
        const side = info.get(person)?.side;
        if (side === undefined) return;

        partners.forEach((partner) => {
          if (!info.has(partner)) {
            info.set(partner, { side });
            changed = true;
          }
        });
      });
    }

    people.forEach((person) => {
      if (!info.has(person)) {
        info.set(person, { side: 0 });
      }
    });

    return info;
  }

  function setSide(info, person, side, force = false) {
    if (!person) return;
    if (force || !info.has(person)) {
      info.set(person, { side });
    }
  }

  function collectAncestors(person, data) {
    const ancestors = new Set();
    const queue = [...(data.parents?.[person] || [])];

    while (queue.length) {
      const ancestor = queue.shift();
      if (ancestors.has(ancestor)) continue;

      ancestors.add(ancestor);
      (data.parents?.[ancestor] || []).forEach((parent) => queue.push(parent));
    }

    return ancestors;
  }

  function findSiblings(child, data) {
    const parents = data.parents?.[child];

    if (!parents) {
      return [child];
    }

    const siblings = Object.entries(data.parents || {})
      .filter(([, candidateParents]) => samePeople(candidateParents, parents))
      .map(([candidateChild]) => candidateChild);

    return siblings.length ? siblings : [child];
  }

  function samePeople(first, second) {
    if (!Array.isArray(first) || !Array.isArray(second) || first.length !== second.length) {
      return false;
    }

    const normalizedFirst = [...first].sort();
    const normalizedSecond = [...second].sort();

    return normalizedFirst.every((name, index) => name === normalizedSecond[index]);
  }

  function computeLayoutPriorities(data, generations = new Map()) {
    const priorities = new Map();
    const partnerMap = buildPartnerMap(data, { inferCoparents: true });
    const explicitPartnerMap = buildPartnerMap(data, { inferCoparents: false });
    const branchInfo = computeBranchInfo(data);
    const lineage = collectRootLineage(data);
    const root = data.root;

    if (root) {
      priorities.set(root, 0);

      const rootParents = data.parents?.[root] || [];
      rootParents.forEach((parent, index) => {
        priorities.set(parent, rootParents.length === 1 ? 0 : index);
      });
    }

    let changed = true;
    let passes = 0;
    const people = collectPeople(data);

    while (changed && passes < people.size * 4) {
      changed = false;
      passes += 1;

      Object.entries(data.parents || {}).forEach(([child, parents]) => {
        const parentPriorities = parents
          .map((parent) => priorities.get(parent))
          .filter((priority) => priority !== undefined);

        if (parentPriorities.length && !priorities.has(child)) {
          priorities.set(child, average(parentPriorities));
          changed = true;
        }

        const childPriority = priorities.get(child);
        if (childPriority !== undefined) {
          parents.forEach((parent) => {
            if (!priorities.has(parent)) {
              priorities.set(parent, childPriority);
              changed = true;
            }
          });
        }
      });

      [...partnerMap.entries()].forEach(([person, partners]) => {
        const priority = priorities.get(person);
        if (priority === undefined) return;

        partners.forEach((partner) => {
          if (!priorities.has(partner)) {
            priorities.set(partner, priority);
            changed = true;
          }
        });
      });
    }

    people.forEach((person, index) => {
      if (!priorities.has(person)) {
        priorities.set(person, 1000 + index);
      }
    });

    refineFamilyPriorities(data, priorities, branchInfo, lineage, explicitPartnerMap, generations);

    return priorities;
  }

  function refineFamilyPriorities(data, priorities, branchInfo, lineage, explicitPartnerMap, generations) {
    const people = collectPeople(data);

    for (let pass = 0; pass < people.size; pass += 1) {
      groupChildrenByParentsWithOrder(data, priorities, branchInfo, lineage).forEach((family) => {
        const parentPriorities = family.parents
          .map((parent) => priorities.get(parent))
          .filter((priority) => priority !== undefined);

        if (!parentPriorities.length) return;

        const familyCenter = average(parentPriorities);
        const familySide = getFamilySide(family, branchInfo);
        const childGeneration = Math.min(...family.children.map((child) => generations.get(child) ?? 0));
        const step = childGeneration <= 0 ? 0.04 : 0.25;
        const start = familySide < 0
          ? familyCenter - (family.children.length - 1) * step
          : familyCenter;

        family.children.forEach((child, index) => {
          priorities.set(child, start + index * step);
        });
      });

      [...explicitPartnerMap.entries()].forEach(([person, partners]) => {
        const priority = priorities.get(person);
        if (priority === undefined) return;

        partners.forEach((partner) => {
          if (!data.parents?.[partner]) {
            priorities.set(partner, priority);
          }
        });
      });
    }
  }

  function groupChildrenByParentsWithOrder(data, priorities, branchInfo, lineage) {
    const families = new Map();

    Object.entries(data.parents || {}).forEach(([child, parents]) => {
      const normalizedParents = [...parents].filter(Boolean).sort();
      if (!normalizedParents.length) return;

      const key = normalizedParents.join("|");

      if (!families.has(key)) {
        families.set(key, {
          parents: normalizedParents,
          children: []
        });
      }

      families.get(key).children.push(child);
    });

    return [...families.values()].map((family) => ({
      parents: orderPeople(family.parents, data, { branchInfo, lineage, priorities }),
      children: orderPeople(family.children, data, { branchInfo, lineage, priorities })
    }));
  }

  function getFamilySide(family, branchInfo) {
    const sides = [...new Set(
      [...family.parents, ...family.children]
        .map((person) => getSide(branchInfo, person))
        .filter((side) => side !== 0)
    )];

    return sides.length === 1 ? sides[0] : 0;
  }

  function collectRootLineage(data) {
    const lineage = new Set();
    const queue = data.root ? [data.root] : [];

    while (queue.length) {
      const person = queue.shift();
      if (lineage.has(person)) continue;

      lineage.add(person);
      (data.parents?.[person] || []).forEach((parent) => queue.push(parent));
    }

    return lineage;
  }

  function buildPartnerMap(data, options = {}) {
    const { inferCoparents = true } = options;
    const map = new Map();

    const addPair = (first, second) => {
      if (!first || !second) return;

      if (!map.has(first)) map.set(first, []);
      if (!map.has(second)) map.set(second, []);

      if (!map.get(first).includes(second)) map.get(first).push(second);
      if (!map.get(second).includes(first)) map.get(second).push(first);
    };

    (data.partners || []).forEach(([first, second]) => addPair(first, second));

    if (inferCoparents) {
      Object.values(data.parents || {}).forEach((parents) => {
        parents.forEach((parent, index) => {
          parents.slice(index + 1).forEach((otherParent) => addPair(parent, otherParent));
        });
      });
    }

    return map;
  }

  function getPartnerPairs(data) {
    return (data.partners || [])
      .filter(([first, second]) => first && second)
      .map(([first, second]) => ({ people: [first, second] }));
  }

  function groupChildrenByParents(data) {
    const families = new Map();

    Object.entries(data.parents || {}).forEach(([child, parents]) => {
      const normalizedParents = [...parents].filter(Boolean).sort();
      if (!normalizedParents.length) return;

      const key = normalizedParents.join("|");

      if (!families.has(key)) {
        families.set(key, {
          parents: normalizedParents,
          children: []
        });
      }

      families.get(key).children.push(child);
    });

    return [...families.values()].map((family) => ({
      parents: orderPeople(family.parents, data),
      children: orderPeople(family.children, data)
    }));
  }

  function getFamilyKey(parents) {
    return [...parents].filter(Boolean).sort().join("|");
  }

  function buildParentChildSegments(family, cards) {
    const parentBoxes = family.parents.map((parent) => cards.get(parent)).filter(Boolean);
    const childBoxes = family.children.map((child) => cards.get(child)).filter(Boolean);

    if (!parentBoxes.length || !childBoxes.length) return [];

    const parentBottom = Math.max(...parentBoxes.map((box) => box.bottom));
    const childTop = Math.min(...childBoxes.map((box) => box.top));
    const gap = Math.max(48, childTop - parentBottom);
    const unionY = parentBottom + Math.min(28, gap * 0.35);
    const childBusY = childTop - Math.min(28, gap * 0.35);
    const familyCenterX = average(parentBoxes.map((box) => box.centerX));
    const childCenters = childBoxes.map((box) => box.centerX);
    const segments = [];

    parentBoxes.forEach((parentBox, index) => {
      segments.push({
        type: "parent-spoke",
        person: family.parents[index],
        d: `M ${parentBox.centerX} ${parentBox.bottom} V ${unionY}`
      });
    });

    if (parentBoxes.length > 1) {
      segments.push({
        type: "parent-bus",
        x1: Math.min(...parentBoxes.map((box) => box.centerX)),
        y1: unionY,
        x2: Math.max(...parentBoxes.map((box) => box.centerX)),
        y2: unionY
      });
    }

    segments.push({
      type: "family-spine",
      d: `M ${familyCenterX} ${unionY} V ${childBusY}`
    });

    if (childBoxes.length > 1) {
      segments.push({
        type: "child-bus",
        x1: Math.min(...childCenters),
        y1: childBusY,
        x2: Math.max(...childCenters),
        y2: childBusY
      });
    }

    childBoxes.forEach((childBox, index) => {
      segments.push({
        type: "child-spoke",
        person: family.children[index],
        d: `M ${childBox.centerX} ${childBusY} V ${childBox.top}`
      });
    });

    return segments;
  }

  function average(numbers) {
    return numbers.reduce((sum, value) => sum + value, 0) / numbers.length;
  }

  function getGenerationLabel(generation) {
    if (generation === 0) return "Root generation";
    if (generation === 1) return "Parents, aunts, uncles";
    if (generation === 2) return "Grandparents";
    if (generation > 2) return `${generation} generations up`;
    if (generation === -1) return "Children";
    return `${Math.abs(generation)} generations down`;
  }

  return {
    assignGenerations,
    buildHybridTreeModel,
    buildLayoutModel,
    buildParentChildSegments,
    buildPartnerMap,
    collectPeople,
    collectRootLineage,
    computeLayoutPriorities,
    getGenerationLabel,
    getFamilyKey,
    getPartnerPairs,
    groupChildrenByParents,
    orderGenerations,
    orderPeople
  };
});
