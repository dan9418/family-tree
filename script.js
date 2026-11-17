const DATA_URL = "family-tree.json";

const treeEl = document.querySelector("#tree");
const titleEl = document.querySelector("#tree-title");
const summaryEl = document.querySelector("#tree-summary");
const detailsEl = document.querySelector("#person-details");

let selectedName = null;
let currentData = null;
let currentModel = null;

init();

async function init() {
  try {
    const response = await fetch(`${DATA_URL}?updated=${Date.now()}`, { cache: "no-store" });

    if (!response.ok) {
      throw new Error(`Could not load ${DATA_URL}`);
    }

    currentData = await response.json();
    currentModel = FamilyLayout.buildHybridTreeModel(currentData);
    renderTree(currentData, currentModel);
  } catch (error) {
    titleEl.textContent = "Family Tree";
    treeEl.innerHTML = `
      <div class="error">
        <strong>Could not load the family tree data.</strong><br>
        Start a local web server from this folder and open the page through that server.
      </div>
    `;
    console.error(error);
  }
}

function renderTree(data, model) {
  titleEl.textContent = data.root || "Family Tree";
  summaryEl.textContent = `${model.people.size} people - ${Object.keys(data.parents || {}).length} parent links`;
  treeEl.innerHTML = "";

  const forest = document.createElement("div");
  forest.className = "hybrid-forest";

  const expandedFamilies = new Set();
  model.rootFamilies.forEach((family) => {
    forest.append(renderFamilyTree(family, data, model, expandedFamilies));
  });

  treeEl.append(forest);
  selectPerson(data.root);
}

function renderFamilyTree(family, data, model, expandedFamilies) {
  const familyKey = FamilyLayout.getFamilyKey(family.parents);
  expandedFamilies.add(familyKey);

  const tree = document.createElement("section");
  tree.className = "family-tree";
  tree.dataset.family = familyKey;

  const parents = document.createElement("div");
  parents.className = "family-parents";
  parents.append(renderCoupleNode(family.parents, data, "Parents"));
  tree.append(parents);

  if (family.children.length) {
    const connector = document.createElement("div");
    connector.className = "family-connector";
    tree.append(connector);

    const children = document.createElement("div");
    children.className = "family-children";

    family.children.forEach((child) => {
      const childUnit = document.createElement("div");
      childUnit.className = "child-unit";
      childUnit.append(renderChildUnit(child, data, model, expandedFamilies));
      children.append(childUnit);
    });

    tree.append(children);
  }

  return tree;
}

function renderChildUnit(person, data, model, expandedFamilies) {
  const partner = getPrimaryPartner(person, model);
  const family = partner
    ? model.familyMap.get(FamilyLayout.getFamilyKey([person, partner]))
    : null;

  if (family) {
    const familyKey = FamilyLayout.getFamilyKey(family.parents);

    if (!expandedFamilies.has(familyKey)) {
      return renderFamilyTree(family, data, model, expandedFamilies);
    }

    return renderFamilyReference([person, partner]);
  }

  if (partner) {
    return renderCoupleNode([person, partner], data, "Partner");
  }

  return renderPersonCard(person, data);
}

function renderCoupleNode(people, data, label = "") {
  const node = document.createElement("div");
  node.className = "couple-node";

  const cards = document.createElement("div");
  cards.className = "couple-cards";
  people.forEach((name) => cards.append(renderPersonCard(name, data)));
  node.append(cards);

  if (label) {
    const badge = document.createElement("div");
    badge.className = "couple-label";
    badge.textContent = label;
    node.append(badge);
  }

  return node;
}

function renderFamilyReference(people) {
  const node = document.createElement("div");
  node.className = "family-reference";
  node.dataset.family = FamilyLayout.getFamilyKey(people);
  node.innerHTML = `
    <span class="reference-title">${people.map(escapeHtml).join(" + ")}</span>
    <span class="reference-label">Family shown elsewhere</span>
  `;

  return node;
}

function getPrimaryPartner(person, model) {
  return (model.partnerMap.get(person) || [])[0] || null;
}

function renderPersonCard(name, data) {
  const details = data.details?.[name] || {};
  const button = document.createElement("button");
  button.type = "button";
  button.className = `person-card${name === data.root ? " root-card" : ""}`;
  button.dataset.name = name;
  button.innerHTML = `
    <span class="person-name">${escapeHtml(name)}</span>
    <span class="person-years">${escapeHtml(formatYears(details))}</span>
  `;
  button.addEventListener("click", () => selectPerson(name));

  return button;
}

function selectPerson(name) {
  selectedName = name;

  document.querySelectorAll(".person-card").forEach((card) => {
    card.classList.toggle("selected", card.dataset.name === selectedName);
  });

  const details = currentData?.details?.[name] || {};
  const parents = currentData?.parents?.[name] || [];
  const partners = FamilyLayout.buildPartnerMap(currentData || {}, { inferCoparents: true }).get(name) || [];
  const children = Object.entries(currentData?.parents || {})
    .filter(([, childParents]) => childParents.includes(name))
    .map(([child]) => child);

  detailsEl.className = "person-details";
  detailsEl.innerHTML = `
    ${detailRow("Name", name)}
    ${detailRow("Born", details.born || "Unknown")}
    ${detailRow("Died", details.died || "Unknown")}
    ${detailRow("Parents", parents.length ? parents.join(", ") : "Unknown")}
    ${detailRow("Partners", partners.length ? partners.join(", ") : "None listed")}
    ${detailRow("Children", children.length ? children.join(", ") : "None listed")}
    ${details.notes ? detailRow("Notes", details.notes) : ""}
  `;
}

function detailRow(label, value) {
  return `
    <div class="detail-row">
      <div class="detail-label">${escapeHtml(label)}</div>
      <div>${escapeHtml(String(value))}</div>
    </div>
  `;
}

function formatYears(details) {
  const born = details.born || "?";
  const died = details.died || "";

  if (!details.born && !details.died) {
    return "Dates unknown";
  }

  return `${born} - ${died}`;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
