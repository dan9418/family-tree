export const GX = 'http://gedcomx.org/';
type Extra = {[key: string]: unknown};
export type Fact = Extra & {type: string; date?: Extra & {original?: string}};
export type Person = Extra & {id: string; names?: (Extra & {nameForms?: (Extra & {fullText?: string})[]})[]};
export type Relationship = Extra & {id: string; type: string; person1: Extra & {resource: string}; person2: Extra & {resource: string}; facts?: Fact[]};
export type Gedcomx = Extra & {persons: Person[]; relationships: Relationship[]};

function object(value: unknown): value is Extra {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

// Validate the editable subset; retain extension properties without interpreting them.
export function parseGedcomx(text: string): Gedcomx {
  const data: unknown = JSON.parse(text);
  if (!object(data) || !Array.isArray(data.persons) || !data.persons.length || !Array.isArray(data.relationships)) throw Error('Expected persons and relationships arrays.');
  const ids = new Set<string>();
  for (const item of [...data.persons, ...data.relationships]) {
    if (!object(item) || typeof item.id !== 'string' || !/^[A-Za-z0-9_-]+$/.test(item.id) || ids.has(item.id)) throw Error('Every person and relationship needs a unique local ID (letters, numbers, _ or -).');
    ids.add(item.id);
  }
  const people = new Set(data.persons.map(p => p.id));
  for (const person of data.persons) {
    if (person.names !== undefined && (!Array.isArray(person.names) || person.names.some((name: unknown) => !object(name) || (name.nameForms !== undefined && (!Array.isArray(name.nameForms) || name.nameForms.some((form: unknown) => !object(form) || (form.fullText !== undefined && typeof form.fullText !== 'string'))))))) throw Error('Invalid person names.');
  }
  for (const rel of data.relationships) {
    if (typeof rel.type !== 'string') throw Error('A relationship needs a type.');
    for (const endpoint of [rel.person1, rel.person2]) {
      if (!object(endpoint) || typeof endpoint.resource !== 'string' || !endpoint.resource.startsWith('#') || !people.has(endpoint.resource.slice(1))) throw Error('Relationships must reference people in this document.');
    }
    if (rel.person1.resource === rel.person2.resource) throw Error('A relationship cannot connect a person to themselves.');
    if (rel.facts !== undefined && (!Array.isArray(rel.facts) || rel.facts.some((fact: unknown) => !object(fact) || typeof fact.type !== 'string' || (fact.date !== undefined && (!object(fact.date) || (fact.date.original !== undefined && typeof fact.date.original !== 'string')))))) throw Error('Invalid relationship facts.');
  }
  return data as Gedcomx;
}
export function serializeGedcomx(data: Gedcomx) {
  const text = JSON.stringify(data, null, 2) + '\n';
  parseGedcomx(text);
  return text;
}
export function personName(person: Person) { return person.names?.[0]?.nameForms?.[0]?.fullText || person.id; }
export function renamePerson(data: Gedcomx, id: string, name: string): Gedcomx {
  if (!name.trim()) throw Error('Name cannot be empty.');
  const next = structuredClone(data);
  const person = next.persons.find(p => p.id === id);
  if (!person) throw Error('Person not found.');
  person.names ??= [];
  person.names[0] ??= {};
  person.names[0].nameForms ??= [];
  person.names[0].nameForms[0] ??= {};
  // A new full name supersedes old parsed components of this name form only.
  delete person.names[0].nameForms[0].parts;
  person.names[0].nameForms[0].fullText = name.trim();
  return next;
}
export function addCoupleEvent(data: Gedcomx, relationshipId: string, type: 'Marriage' | 'Divorce', date: string): Gedcomx {
  const next = structuredClone(data);
  const relationship = next.relationships.find(r => r.id === relationshipId);
  if (!relationship || relationship.type !== GX + 'Couple') throw Error('Select a couple relationship.');
  if (!['Marriage', 'Divorce'].includes(type)) throw Error('Unsupported event type.');
  relationship.facts ??= [];
  relationship.facts.push({type: GX + type, ...(date.trim() ? {date: {original: date.trim()}} : {})});
  return next;
}

export const fictionalDocument: Gedcomx = {
  persons: [
    {id: 'alex', names: [{nameForms: [{fullText: 'Alex Example'}]}]},
    {id: 'robin', names: [{nameForms: [{fullText: 'Robin Sample'}]}]},
    {id: 'casey', names: [{nameForms: [{fullText: 'Casey Example'}]}]}
  ],
  relationships: [
    {id: 'couple-alex-robin', type: GX + 'Couple', person1: {resource: '#alex'}, person2: {resource: '#robin'}, facts: []},
    {id: 'parent-alex-casey', type: GX + 'ParentChild', person1: {resource: '#alex'}, person2: {resource: '#casey'}}
  ]
};
