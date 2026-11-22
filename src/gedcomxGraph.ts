import {GX, personName, type Gedcomx} from './gedcomx';
import type {RelationshipGraph} from './relationships';

// Parent-child assertions stay independent of couple history: no inferred parentage.
export function gedcomxGraph(data: Gedcomx): RelationshipGraph {
  return {
    people: data.persons.map(p => p.id).sort(),
    labels: Object.fromEntries(data.persons.map(p => [p.id, personName(p)])),
    families: data.relationships.filter(r => r.type === GX + 'Couple' || r.type === GX + 'ParentChild')
      .map(r => ({
        id: r.id,
        parents: r.type === GX + 'Couple' ? [r.person1.resource.slice(1), r.person2.resource.slice(1)] : [r.person1.resource.slice(1)],
        children: r.type === GX + 'ParentChild' ? [r.person2.resource.slice(1)] : [],
        label: r.type === GX + 'Couple' ? 'Partnership' : 'Parent-child',
        events: (r.facts || []).map(f => `${f.type.startsWith(GX) ? f.type.slice(GX.length) : f.type}: ${f.date?.original || 'Date unknown'}`)
      })).sort((a,b) => a.id.localeCompare(b.id))
  };
}
