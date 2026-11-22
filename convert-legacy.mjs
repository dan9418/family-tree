import {readFileSync, writeFileSync} from 'node:fs';
import {parseGedcomx} from './src/gedcomx.ts';

const source = JSON.parse(readFileSync('family-tree.json', 'utf8'));
const names = new Set([source.root, ...Object.keys(source.parents || {}), ...Object.values(source.parents || {}).flat(), ...(source.partners || []).flat(), ...Object.keys(source.details || {})]);
const known = [...names].filter(name => typeof name === 'string' && name.trim() && name !== '?');
const ids = new Map(known.map((name, index) => [name, `person-${index + 1}`]));
const uri = 'http://gedcomx.org/';
const persons = known.map(name => {
  const details = source.details?.[name] || {};
  const facts = [['born','Birth'], ['died','Death']].filter(([key]) => details[key] != null && details[key] !== '').map(([key,type]) => ({type:uri+type,date:{original:String(details[key])}}));
  return {id:ids.get(name),names:[{nameForms:[{fullText:name}]}], ...(facts.length ? {facts}:{}), ...(details.notes ? {notes:[{text:String(details.notes)}]}:{})};
});
const relationships = [];
const seen = new Set();
function add(type, first, second) {
  if(!ids.has(first) || !ids.has(second)) return;
  const key = JSON.stringify([type, ...(type === 'Couple' ? [first,second].sort() : [first,second])]);
  if(seen.has(key)) return;
  seen.add(key);
  relationships.push({id:`relationship-${relationships.length+1}`,type:uri+type,person1:{resource:'#'+ids.get(first)},person2:{resource:'#'+ids.get(second)}});
}
for(const pair of source.partners || []) add('Couple', ...pair);
for(const [child, parents] of Object.entries(source.parents || {})) for(const parent of parents) add('ParentChild',parent,child);
const document = {persons,relationships};
const text = JSON.stringify(document,null,2)+'\n';
parseGedcomx(text);
writeFileSync('family-tree.gedcomx.json',text,{flag:'wx'});
console.log(`Created private GEDCOM X copy: ${persons.length} people, ${relationships.length} relationships. Unknown placeholders omitted; no marriage or biological-parent facts inferred.`);
