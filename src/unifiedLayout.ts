import dagre from '@dagrejs/dagre';
import type {RelationshipGraph} from './relationships';

type Point = {x:number;y:number};
type Box = Point & {width:number;height:number};
export type RoutedEdge = {id:string;kind:'partner'|'parent';points:Point[]};

// Lay out partnership components as horizontal units, then rank their ancestry.
export function unifiedLayout(model: RelationshipGraph) {
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
    return {nodes:new Map(graph.nodes().map(id=>[id,graph.node(id) as Box])),edges:graph.edges().map(e=>({id:JSON.stringify(e),kind:graph.edge(e).kind as 'parent'|'partner',points:graph.edge(e).points as Point[]})),width:graph.graph().width||100,height:graph.graph().height||100};
  }
  dagre.layout(outer);
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
      edges.push({id:JSON.stringify(['partner',family.id,parent]),kind:'partner',points:obstructed?[start,{x:start.x+direction*10,y:start.y},{x:start.x+direction*10,y:lane},{x:end.x-direction*10,y:lane},{x:end.x-direction*10,y:end.y},end]:[start,end]});
    });
  });
  let laneIndex=0;
  for(const family of model.families) for(const parent of family.parents) for(const child of family.children) {
    const source=nodes.get('p:'+parent)!, target=nodes.get('p:'+child)!;
    const route=outer.edge({v:find(parent),w:find(child),name:JSON.stringify([family.id,parent,child])});
    const start={x:source.x,y:source.y+source.height/2};
    const end={x:target.x,y:target.y-target.height/2};
    const middle=start.y+(end.y-start.y)*(0.35+(laneIndex++%7)*0.05);
    let points:Point[];
    if(route && route.points.length>3) {
      const interior=route.points.slice(1,-1) as Point[];
      points=[start,{x:start.x,y:interior[0].y},...interior,{x:end.x,y:interior[interior.length-1].y},end];
    } else points=[start,{x:start.x,y:middle},{x:end.x,y:middle},end];
    edges.push({id:JSON.stringify(['parent',family.id,parent,child]),kind:'parent',points});
    if(!nodes.has('f:'+family.id)) nodes.set('f:'+family.id,{x:start.x,y:middle,width:10,height:10});
  }
  return {nodes,edges,width:outer.graph().width||100,height:outer.graph().height||100};
}
