import assert from 'node:assert/strict';
import {unifiedLayout} from './src/unifiedLayout.ts';
const model={people:['a','b','c','d'],families:[
  {id:'ab',parents:['a','b'],children:[],label:'Partnership',events:['Marriage: 2000']},
  {id:'ac',parents:['a','c'],children:[],label:'Partnership'},
  {id:'ad',parents:['a'],children:['d'],label:'Parent-child'},
  {id:'bd',parents:['b'],children:['d'],label:'Parent-child'}
]};
const layout=unifiedLayout(model);
for(const id of ['p:b','p:c','f:ab','f:ac']) assert.equal(layout.nodes.get(id).y,layout.nodes.get('p:a').y);
assert.ok(layout.nodes.get('p:d').y>layout.nodes.get('p:a').y+100);
assert.equal(layout.edges.filter(e=>e.kind==='parent').length,2);
assert.equal(layout.edges.filter(e=>e.kind==='partner').length,4);
const boxes=[...layout.nodes.values()];
for(let i=0;i<boxes.length;i++)for(let j=i+1;j<boxes.length;j++){
  const a=boxes[i],b=boxes[j];
  assert.ok(Math.abs(a.x-b.x)>=(a.width+b.width)/2||Math.abs(a.y-b.y)>=(a.height+b.height)/2,'Nodes must not overlap');
}
const unusual=unifiedLayout({people:['a','b'],families:[{id:'couple',parents:['a','b'],children:[]},{id:'parent',parents:['a'],children:['b']}]});
assert.equal(unusual.nodes.size,4,'Fallback must preserve all people and relationships');
assert.ok(unusual.edges.every(e=>e.points.every(p=>Number.isFinite(p.x)&&Number.isFinite(p.y))));
console.log('Unified layout geometry checks passed.');
