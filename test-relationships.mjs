import assert from 'node:assert/strict';
import {relationships} from './src/relationships.ts';

const data = {
  root: 'Root Example',
  parents: {
    'Child One': ['Root Example'],
    'Child Two': ['Root Example', 'Partner One'],
    'Child Three': ['Partner Two', 'Root Example'],
    'Child Four': ['Root Example', 'Partner One'],
    'Independent Example': []
  },
  partners: [['Root Example', 'Partner One'], ['Partner One', 'Root Example']],
  details: {'Isolated Example': {}}
};
const model = relationships(data);
assert.equal(model.people.length, 9);
assert.equal(model.families.length, 3);
assert.deepEqual(model.families.find(f => f.parents.length === 1)?.children, ['Child One']);
assert.deepEqual(model.families.find(f => f.parents.includes('Partner One'))?.children, ['Child Four', 'Child Two']);
assert.deepEqual(model.families.find(f => f.parents.includes('Partner Two'))?.children, ['Child Three']);
assert.ok(model.people.includes('Independent Example'));
assert.ok(model.people.includes('Isolated Example'));
const reversed = {...data, parents: Object.fromEntries(Object.entries(data.parents).reverse().map(([child, parents]) => [child, [...parents].reverse()])), partners: [...data.partners].reverse()};
assert.deepEqual(relationships(reversed), model, 'JSON ordering should not change the relationship model');
assert.equal(new Set(model.families.flatMap(f => f.children)).size, 4);
console.log('Relationship tests passed.');
