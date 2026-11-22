import assert from 'node:assert/strict';
import {mkdtempSync, writeFileSync, readFileSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {GX, fictionalDocument, parseGedcomx, serializeGedcomx, renamePerson, addCoupleEvent} from './src/gedcomx.ts';

const original = structuredClone(fictionalDocument);
original.customExtension = {preserve: ['evidence', 'notes']};
original.persons[0].names.push({nameForms: [{fullText: 'Alternate Example'}]});
let edited = renamePerson(original, 'alex', 'Alex Revised');
for(const [type, date] of [['Marriage','2000'], ['Divorce','2010'], ['Marriage','2015']]) {
  edited = addCoupleEvent(edited, 'couple-alex-robin', type, date);
}
const directory = mkdtempSync(join(tmpdir(), 'family-fictional-roundtrip-'));
try {
  const path = join(directory, 'fictional.gedcomx.json');
  writeFileSync(path, serializeGedcomx(edited));
  const reopened = parseGedcomx(readFileSync(path, 'utf8'));
  assert.deepEqual(reopened, edited);
  assert.equal(reopened.persons[0].id, 'alex');
  assert.equal(reopened.relationships[0].person1.resource, '#alex');
  assert.deepEqual(reopened.relationships[0].facts.map(f => f.type), [GX+'Marriage', GX+'Divorce', GX+'Marriage']);
  assert.deepEqual(reopened.customExtension, original.customExtension);
  assert.deepEqual(reopened.persons[0].names[1], original.persons[0].names[1]);
} finally { rmSync(directory, {recursive:true}); }
assert.equal(original.persons[0].names[0].nameForms[0].fullText, 'Alex Example');
assert.equal(original.relationships[0].facts.length, 0);
assert.throws(() => renamePerson(original,'alex',' '));
assert.throws(() => addCoupleEvent(original,'parent-alex-casey','Marriage','2000'));
const invalid = structuredClone(original);
invalid.relationships[0].person1.resource='#missing';
assert.throws(() => parseGedcomx(JSON.stringify(invalid)));
invalid.relationships[0].person1.resource='#alex';
invalid.persons[1].id='alex';
assert.throws(() => parseGedcomx(JSON.stringify(invalid)));
console.log('GEDCOM X fictional file round-trip and validation checks passed.');
