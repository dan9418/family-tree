export type FamilyData = { root: string; parents: Record<string, string[]>; partners: string[][]; details?: Record<string, {born?: string|number; died?: string|number; notes?: string}> };
export type RelationshipGraph = {
  people: string[];
  labels?: Record<string, string>;
  years?: Record<string, string>;
  families: {id: string; parents: string[]; children: string[]; label?: string; events?: string[]}[];
};
export function relationships(data: FamilyData) {
  const people = new Set<string>([data.root, ...Object.keys(data.details || {})]);
  const families = new Map<string, {id:string; parents:string[]; children:string[]}>();
  function add(parents:string[], child?:string) {
    const names = [...new Set(parents)].sort();
    names.forEach(n=>people.add(n));
    if(child) people.add(child);
    if(!names.length) return;
    const id = JSON.stringify(names);
    if(!families.has(id)) families.set(id,{id,parents:names,children:[]});
    if(child) families.get(id)!.children.push(child);
  }
  Object.entries(data.parents).forEach(([child,parents])=>add(parents,child));
  data.partners.forEach(pair=>add(pair));
  families.forEach(family => family.children.sort());
  return {people:[...people].sort(),families:[...families.values()].sort((a,b)=>a.id.localeCompare(b.id))};
}
