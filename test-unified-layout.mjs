import assert from 'node:assert/strict';
import {unifiedLayout, displayEdges, parentGroups, allocateLane} from './src/unifiedLayout.ts';
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
assert.equal(displayEdges(shared.edges).filter(e=>e.kind==='parent').length,4,'Aligned partnership and center-child stems merge into one stroke');
for(const edge of semantic) {
  assert.ok(edge.points.every(p=>Number.isFinite(p.x)&&Number.isFinite(p.y)));
}
const partial=unifiedLayout({...siblings, families:siblings.families.filter(f=>f.id!=='be')});
assert.equal(new Set(partial.edges.filter(e=>e.kind==='parent').map(e=>e.points[1].y)).size,2,'Half siblings keep distinct parent-set buses');

const edge=(id,groupId,x1,x2)=>({id,groupId,kind:'parent',points:[{x:x1,y:10},{x:x2,y:10}]});
assert.equal(displayEdges([edge('a','one',0,100),edge('b','two',50,150)]).length,2,'Different parent groups never merge');
assert.equal(displayEdges([edge('a','one',0,100),edge('b','one',50,150)]).length,1);
const lanes=[];
for(let i=0;i<12;i++) allocateLane(lanes,String(i),0,100,10,200);
assert.equal(new Set(lanes.map(l=>l.y)).size,12,'No seven-lane wraparound');
assert.equal(allocateLane(lanes,'disjoint',200,300,10,200),10,'Non-overlapping intervals reuse space');
const wide={people:[],families:[]};
for(let i=0;i<12;i++) {
  wide.people.push('p'+i,'q'+i,'c'+i);
  wide.families.push({id:'pair'+i,parents:['p'+i,'q'+i],children:[]},{id:'p-child'+i,parents:['p'+i],children:['c'+i]},{id:'q-child'+i,parents:['q'+i],children:['c'+i]});
}
assert.equal(unifiedLayout(wide).edges.filter(e=>e.kind==='parent').length,24,'Wide pedigrees allocate enough routing space');
assert.deepEqual(parentGroups({...siblings,families:[...siblings.families].reverse()}),parentGroups(siblings),'Parent groups do not depend on assertion order');

const relation=(parent,child)=>({id:parent+child,parents:[parent],children:[child]});
const fixtures={
  remarriage:{people:['a','b','c','d','e'],families:[{id:'ab',parents:['a','b'],children:[]},{id:'ac',parents:['a','c'],children:[]},relation('a','d'),relation('b','d'),relation('a','e'),relation('c','e')]},
  ambiguous:{...siblings,families:[...siblings.families,{id:'ab-again',parents:['a','b'],children:[]}]},
  unknown:{people:['a','b','c'],families:[relation('a','b')]},
  noPartnership:{people:['a','b','c'],families:[relation('a','c'),relation('b','c')]},
  generations:{people:['a','b','c','d'],families:[relation('a','b'),relation('b','c'),relation('a','d'),relation('c','d')]}
};
assert.deepEqual(parentGroups(fixtures.remarriage).map(g=>g.partnershipId),['ab','ac']);
assert.equal(parentGroups(fixtures.ambiguous)[0].partnershipId,undefined,'Multiple partnership records are not guessed');
assert.deepEqual(parentGroups(fixtures.unknown)[0].parents,['a'],'Unknown parent is not invented');
assert.equal(parentGroups(fixtures.noPartnership)[0].partnershipId,undefined);
for(const [name,fixture] of Object.entries(fixtures)) {
  const result=unifiedLayout(fixture);
  const expected=fixture.families.reduce((sum,f)=>sum+f.parents.length*f.children.length,0);
  assert.equal(result.edges.filter(e=>e.kind==='parent').length,expected,name+' preserves every assertion');
  assert.deepEqual(result.parentGroups,parentGroups(fixture));
  for(const e of result.edges.filter(e=>e.kind==='parent')) {
    assert.ok(e.groupId,name+' carries parent-group identity');
    assert.ok(e.points.every(p=>Number.isFinite(p.x)&&Number.isFinite(p.y)));
    for(let i=1;i<e.points.length;i++) assert.ok(e.points[i].x===e.points[i-1].x||e.points[i].y===e.points[i-1].y,name+' routes orthogonally');
    for(let i=1;i<e.points.length;i++) for(const box of result.nodes.values()) {
      if(box.width<=10) continue;
      const a=e.points[i-1],b=e.points[i];
      const left=box.x-box.width/2+0.01,right=box.x+box.width/2-0.01,top=box.y-box.height/2+0.01,bottom=box.y+box.height/2-0.01;
      const collision=a.x===b.x ? a.x>left&&a.x<right&&Math.max(a.y,b.y)>top&&Math.min(a.y,b.y)<bottom : a.y>top&&a.y<bottom&&Math.max(a.x,b.x)>left&&Math.min(a.x,b.x)<right;
      assert.ok(!collision,name+' ancestry avoids card interiors');
    }
  }
}
console.log('Parent-group, lane, remarriage, unknown-parent, and multi-generation checks passed.');
