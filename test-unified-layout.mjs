import assert from 'node:assert/strict';
import {unifiedLayout, displayEdges} from './src/unifiedLayout.ts';
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
const boxes=[...layout.nodes.values()].filter(box=>box.width>10);
for(let i=0;i<boxes.length;i++)for(let j=i+1;j<boxes.length;j++){
  const a=boxes[i],b=boxes[j];
  assert.ok(Math.abs(a.x-b.x)>=(a.width+b.width)/2||Math.abs(a.y-b.y)>=(a.height+b.height)/2,'Nodes must not overlap');
}
const unusual=unifiedLayout({people:['a','b'],families:[{id:'couple',parents:['a','b'],children:[]},{id:'parent',parents:['a'],children:['b']}]});
assert.equal(unusual.nodes.size,4,'Fallback must preserve all people and relationships');
assert.ok(unusual.edges.every(e=>e.points.every(p=>Number.isFinite(p.x)&&Number.isFinite(p.y))));
console.log('Unified layout geometry checks passed.');
const siblings={people:['a','b','c','d','e'],families:[
  {id:'ab',parents:['a','b'],children:[]},
  ...['c','d','e'].flatMap(child=>['a','b'].map(parent=>({id:parent+child,parents:[parent],children:[child]})))
]};
const shared=unifiedLayout(siblings);
const semantic=shared.edges.filter(e=>e.kind==='parent');
assert.equal(semantic.length,6,'All parent-child assertions remain represented');
const horizontals=displayEdges(shared.edges).filter(e=>e.kind==='parent'&&e.points[0].y===e.points[1].y);
assert.equal(horizontals.length,1,'Siblings with identical parents use one shared bus');
assert.equal(displayEdges(shared.edges).filter(e=>e.kind==='parent').length,6,'Two parent stems, three child stems, one bus');
for(const edge of semantic) {
  assert.ok(edge.points.every(p=>Number.isFinite(p.x)&&Number.isFinite(p.y)));
}
const partial=unifiedLayout({...siblings, families:siblings.families.filter(f=>f.id!=='be')});
assert.equal(new Set(partial.edges.filter(e=>e.kind==='parent').map(e=>e.points[1].y)).size,2,'Half siblings keep distinct parent-set buses');
