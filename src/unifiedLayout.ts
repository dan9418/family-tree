import dagre from '@dagrejs/dagre';
import type {RelationshipGraph} from './relationships';

type Point = {x:number;y:number};
type Box = Point & {width:number;height:number};
export type RoutedEdge = {id:string;kind:'partner'|'parent';points:Point[];groupId?:string;relationshipId?:string};
export type ParentGroup = {id:string;parents:string[];children:string[];partnershipId?:string};

export function parentGroups(model: RelationshipGraph): ParentGroup[] {
  const byChild=new Map<string,Set<string>>();
  for(const family of model.families) for(const child of family.children) {
    if(!byChild.has(child)) byChild.set(child,new Set());
    family.parents.forEach(parent=>byChild.get(child)!.add(parent));
  }
  const groups=new Map<string,ParentGroup>();
  for(const [child,parentsSet] of byChild) {
    const parents=[...parentsSet].sort();
    if(!parents.length) continue;
    const id=JSON.stringify(parents);
    if(!groups.has(id)) {
      const matches=model.families.filter(f=>f.parents.length>1 && JSON.stringify([...new Set(f.parents)].sort())===id);
      groups.set(id,{id,parents,children:[],...(matches.length===1?{partnershipId:matches[0].id}:{})});
    }
    groups.get(id)!.children.push(child);
  }
  return [...groups.values()].map(g=>({...g,children:g.children.sort()})).sort((a,b)=>a.id.localeCompare(b.id));
}

type Lane = {groupId:string;y:number;left:number;right:number};
function inside(p:Point,b:Box) {return p.x>b.x-b.width/2 && p.x<b.x+b.width/2 && p.y>b.y-b.height/2 && p.y<b.y+b.height/2;}
function intersects(a:Point,b:Point,box:Box) {
  const left=box.x-box.width/2,right=box.x+box.width/2,top=box.y-box.height/2,bottom=box.y+box.height/2;
  return a.x===b.x ? a.x>left&&a.x<right&&Math.max(a.y,b.y)>top&&Math.min(a.y,b.y)<bottom : a.y>top&&a.y<bottom&&Math.max(a.x,b.x)>left&&Math.min(a.x,b.x)<right;
}

// Only obstructed segments need a visibility-grid detour. Dagre still owns ranking.
function avoidCards(points:Point[],boxes:Box[]):Point[] {
  const waypoints=points.filter((p,i)=>i===0||i===points.length-1||!boxes.some(b=>inside(p,b)));
  const output=[waypoints[0]];
  for(const end of waypoints.slice(1)) {
    const start=output[output.length-1];
    if((start.x===end.x||start.y===end.y)&&!boxes.some(b=>intersects(start,end,b))) {output.push(end);continue;}
    const xs=[...new Set([start.x,end.x,...boxes.flatMap(b=>[b.x-b.width/2-12,b.x+b.width/2+12])])].sort((a,b)=>a-b);
    const ys=[...new Set([start.y,end.y,...boxes.flatMap(b=>[b.y-b.height/2-12,b.y+b.height/2+12])])].sort((a,b)=>a-b);
    const graph=new dagre.graphlib.Graph({directed:false});
    const key=(x:number,y:number)=>JSON.stringify([x,y]);
    for(const x of xs) for(const y of ys) if(!boxes.some(b=>inside({x,y},b))) graph.setNode(key(x,y),{x,y});
    for(let i=0;i<xs.length;i++) for(let j=0;j<ys.length;j++) {
      const a={x:xs[i],y:ys[j]},id=key(a.x,a.y);
      if(!graph.hasNode(id)) continue;
      for(const b of [i+1<xs.length?{x:xs[i+1],y:ys[j]}:null,j+1<ys.length?{x:xs[i],y:ys[j+1]}:null]) {
        if(b && graph.hasNode(key(b.x,b.y)) && !boxes.some(box=>intersects(a,b,box))) graph.setEdge(id,key(b.x,b.y),Math.abs(a.x-b.x)+Math.abs(a.y-b.y));
      }
    }
    const source=key(start.x,start.y),target=key(end.x,end.y);
    const paths=dagre.graphlib.alg.dijkstra(graph,source,e=>graph.edge(e),v=>graph.nodeEdges(v)||[]);
    if(!Number.isFinite(paths[target]?.distance)) throw Error('Cannot route ancestry around cards.');
    const detour:Point[]=[];
    for(let id=target;id!==source;id=paths[id].predecessor!) detour.push(graph.node(id));
    output.push(...detour.reverse());
  }
  return output;
}
export function allocateLane(occupied: Lane[], groupId:string, left:number, right:number, low:number, high:number): number {
  for(let y=low;y<=high;y+=12) {
    if(!occupied.some(l=>Math.abs(l.y-y)<12 && left<=l.right+12 && right>=l.left-12)) {
      occupied.push({groupId,y,left,right}); return y;
    }
  }
  throw Error('Insufficient ancestry routing space.');
}

// Merge collinear strokes for display only; semantic edges remain individually testable.
export function displayEdges(edges: RoutedEdge[]): RoutedEdge[] {
  const result = edges.filter(e => e.kind === 'partner');
  const lines = new Map<string, {horizontal:boolean; fixed:number; ranges:number[][]}>();
  for (const edge of edges.filter(e => e.kind === 'parent')) {
    for (let i=1;i<edge.points.length;i++) {
      const a=edge.points[i-1], b=edge.points[i];
      if (a.x===b.x && a.y===b.y) continue;
      if (a.x!==b.x && a.y!==b.y) {result.push({id:`${edge.id}:${i}`,kind:'parent',points:[a,b]});continue;}
      const horizontal=a.y===b.y, fixed=horizontal?a.y:a.x;
      const key=JSON.stringify([edge.groupId ?? edge.id,horizontal,fixed]);
      if (!lines.has(key)) lines.set(key,{horizontal,fixed,ranges:[]});
      lines.get(key)!.ranges.push([Math.min(horizontal?a.x:a.y,horizontal?b.x:b.y),Math.max(horizontal?a.x:a.y,horizontal?b.x:b.y)]);
    }
  }
  for (const [key,line] of lines) {
    const merged:number[][]=[];
    for (const range of line.ranges.sort((a,b)=>a[0]-b[0])) {
      const last=merged[merged.length-1];
      if(last && range[0]<=last[1]) last[1]=Math.max(last[1],range[1]);
      else merged.push([...range]);
    }
    merged.forEach(([start,end],i)=>result.push({id:`stroke:${key}:${i}`,kind:'parent',points:line.horizontal?[{x:start,y:line.fixed},{x:end,y:line.fixed}]:[{x:line.fixed,y:start},{x:line.fixed,y:end}]}));
  }
  return result;
}

// Lay out partnership components as horizontal units, then rank their ancestry.
export function unifiedLayout(model: RelationshipGraph) {
  const ancestryGroups=parentGroups(model);
  const couples = model.families.filter(f => f.parents.length > 1);
  const owner = new Map(model.people.map(id => [id,id]));
  function find(id:string):string {const parent=owner.get(id)!;return parent===id?id:find(parent);}
  for(const couple of couples) for(const id of couple.parents.slice(1)) owner.set(find(id),find(couple.parents[0]));
  const groups = new Map<string,string[]>();
  for(const id of model.people) {const key=find(id);if(!groups.has(key))groups.set(key,[]);groups.get(key)!.push(id);}
  const outer = new dagre.graphlib.Graph({multigraph:true});
  outer.setGraph({rankdir:'TB',nodesep:65,ranksep:120,marginx:30,marginy:30});
  outer.setDefaultEdgeLabel(()=>({}));
  const local = new Map<string,Map<string,Box>>();
  for(const [key, people] of groups) {
    const positions = new Map<string,Box>();
    const groupCouples=couples.filter(f=>find(f.parents[0])===key);
    const sequence:string[]=[];
    const visited=new Set<string>();
    function visit(id:string) {
      if(visited.has(id))return;
      visited.add(id);sequence.push('p:'+id);
      for(const f of groupCouples.filter(f=>f.parents.includes(id))) {
        if(!sequence.includes('f:'+f.id)) sequence.push('f:'+f.id);
        f.parents.filter(p=>p!==id).forEach(visit);
      }
    }
    people.forEach(visit);
    const height=100;
    const top=30+groupCouples.length*14;
    let x=0;
    for(const id of sequence) {
      const width=id.startsWith('p:')?184:140;
      positions.set(id,{x:x+width/2,y:top+height/2,width,height:id.startsWith('p:')?100:72});
      x+=width+28;
    }
    local.set(key,positions);
    outer.setNode(key,{width:Math.max(1,x-28),height:top+height});
  }
  for(const family of model.families) for(const parent of family.parents) for(const child of family.children) {
    if(find(parent)!==find(child)) outer.setEdge(find(parent),find(child),{},JSON.stringify([family.id,parent,child]));
  }
  // Some pedigrees cannot satisfy same-row partnerships and downward ancestry together.
  // Retain a valid directed graph in those cases instead of dropping relationships.
  if (!dagre.graphlib.alg.isAcyclic(outer) || model.families.some(f => f.parents.some(p => f.children.some(c => find(p) === find(c))))) {
    const graph = new dagre.graphlib.Graph();
    graph.setGraph({rankdir:'TB',nodesep:50,ranksep:90,marginx:30,marginy:30});
    graph.setDefaultEdgeLabel(()=>({}));
    model.people.forEach(id=>graph.setNode('p:'+id,{width:184,height:100}));
    model.families.forEach(f=>{
      graph.setNode('f:'+f.id,{width:f.parents.length>1?140:10,height:f.parents.length>1?72:10});
      f.parents.forEach(p=>graph.setEdge('p:'+p,'f:'+f.id,{kind:f.children.length?'parent':'partner'}));
      f.children.forEach(c=>graph.setEdge('f:'+f.id,'p:'+c,{kind:'parent'}));
    });
    dagre.layout(graph);
    return {parentGroups:ancestryGroups,nodes:new Map(graph.nodes().map(id=>[id,graph.node(id) as Box])),edges:graph.edges().map((e):RoutedEdge=>({id:JSON.stringify(e),relationshipId:(e.v.startsWith('f:')?e.v:e.w).slice(2),kind:graph.edge(e).kind as 'parent'|'partner',points:graph.edge(e).points as Point[]})),width:graph.graph().width||100,height:graph.graph().height||100};
  }
  dagre.layout(outer);
  // Reserve enough vertical space for the busiest ancestry tier; lanes never wrap.
  const tierDemand=new Map<number,number>();
  for(const group of ancestryGroups) {
    const tier=Math.max(...group.parents.map(id=>outer.node(find(id)).y));
    tierDemand.set(tier,(tierDemand.get(tier)||0)+1);
  }
  const ranksep=Math.max(120,48+12*Math.max(0,...tierDemand.values()));
  if(ranksep>120) {outer.graph().ranksep=ranksep;dagre.layout(outer);}
  const nodes=new Map<string,Box>();
  for(const [key,positions] of local) {
    const group=outer.node(key);
    for(const [id,point] of positions) nodes.set(id,{...point,x:group.x-group.width/2+point.x,y:group.y-group.height/2+point.y});
  }
  const edges:RoutedEdge[]=[];
  couples.forEach(family=>{
    const junction=nodes.get('f:'+family.id)!;
    family.parents.forEach(parent=>{
      const person=nodes.get('p:'+parent)!;
      const direction=junction.x>person.x?1:-1;
      const start={x:person.x+direction*person.width/2,y:person.y};
      const end={x:junction.x-direction*junction.width/2,y:junction.y};
      const obstructed=[...nodes.entries()].some(([id,p])=>id!=='p:'+parent&&id!=='f:'+family.id&&p.y===person.y&&p.x>Math.min(person.x,junction.x)&&p.x<Math.max(person.x,junction.x));
      const group=outer.node(find(parent));
      const index=couples.filter(f=>find(f.parents[0])===find(parent)).findIndex(f=>f.id===family.id);
      const lane=group.y-group.height/2+10+index*14;
      edges.push({id:JSON.stringify(['partner',family.id,parent]),kind:'partner',relationshipId:family.id,points:obstructed?[start,{x:start.x+direction*10,y:start.y},{x:start.x+direction*10,y:lane},{x:end.x-direction*10,y:lane},{x:end.x-direction*10,y:end.y},end]:[start,end]});
    });
  });
  const groupByChild=new Map(ancestryGroups.flatMap(group=>group.children.map(child=>[child,group] as const)));
  const occupied:Lane[]=[];
  const buses=new Map<string,number>();
  for(const group of ancestryGroups) {
    const sources=group.parents.map(id=>nodes.get('p:'+id)!);
    const bottom=Math.max(...sources.map(p=>p.y+p.height/2));
    const targets=group.children.map(id=>nodes.get('p:'+id)!);
    const firstTop=Math.min(...targets.map(p=>p.y-p.height/2));
    const xs=[...sources,...targets].map(p=>p.x);
    buses.set(group.id,allocateLane(occupied,group.id,Math.min(...xs),Math.max(...xs),bottom+24,firstTop-24));
  }
  for(const family of model.families) for(const parent of family.parents) for(const child of family.children) {
    const source=nodes.get('p:'+parent)!, target=nodes.get('p:'+child)!;
    const group=groupByChild.get(child)!;
    const routeParent=group.parents.reduce((a,b)=>nodes.get('p:'+a)!.y>=nodes.get('p:'+b)!.y?a:b);
    const routeFamily=model.families.find(f=>f.parents.includes(routeParent)&&f.children.includes(child))!;
    const route=outer.edge({v:find(routeParent),w:find(child),name:JSON.stringify([routeFamily.id,routeParent,child])});
    const origin=group.partnershipId ? nodes.get('f:'+group.partnershipId)! : source;
    const start={x:origin.x,y:origin.y+origin.height/2};
    const end={x:target.x,y:target.y-target.height/2};
    const parents=group.parents;
    const sameRow=parents.every(id=>nodes.get('p:'+id)!.y===source.y);
    const middle=buses.get(group.id)!;
    let points:Point[];
    if(!sameRow || (route && route.points.length>3)) {
      if (!route) throw Error('Missing ancestry route.');
      const interior=(route.points.slice(1,-1) as Point[]).filter(p=>p.y>middle && p.y<end.y);
      points=[start,{x:start.x,y:middle}];
      for(const point of interior) {
        const previous=points[points.length-1];
        points.push({x:point.x,y:previous.y},point);
      }
      points.push({x:end.x,y:points[points.length-1].y},end);
    } else points=[start,{x:start.x,y:middle},{x:end.x,y:middle},end];
    points=avoidCards(points,[...nodes.values()].filter(box=>box.width>10));
    edges.push({id:JSON.stringify(['parent',family.id,parent,child]),kind:'parent',groupId:group.id,points});
    if(!nodes.has('f:'+family.id)) nodes.set('f:'+family.id,{x:start.x,y:middle,width:10,height:10});
  }
  return {parentGroups:ancestryGroups,nodes,edges,width:outer.graph().width||100,height:outer.graph().height||100};
}
