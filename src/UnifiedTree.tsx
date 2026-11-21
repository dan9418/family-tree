import {useMemo, useState} from 'react';
import dagre from '@dagrejs/dagre';
import {relationships, type FamilyData} from './relationships';

export function UnifiedTree({data,selected,onSelect}:{data:FamilyData;selected:string;onSelect:(name:string)=>void}) {
  const [zoom,setZoom]=useState(1);
  const layout=useMemo(()=>{
    const model=relationships(data), g=new dagre.graphlib.Graph();
    g.setGraph({rankdir:'TB',nodesep:35,ranksep:55,marginx:25,marginy:25});
    g.setDefaultEdgeLabel(()=>({}));
    model.people.forEach(n=>g.setNode('p:'+n,{width:184,height:100}));
    model.families.forEach(f=>{
      const id='f:'+f.id;g.setNode(id,{width:12,height:12});
      f.parents.forEach(n=>g.setEdge('p:'+n,id));
      f.children.forEach(n=>g.setEdge(id,'p:'+n));
    });
    dagre.layout(g);
    return {model,g};
  },[data]);
  const {model,g}=layout, width=g.graph().width||100,height=g.graph().height||100;
  return <><label>Zoom <input aria-label="Zoom" type="range" min="0.25" max="1.5" step="0.05" value={zoom} onChange={e=>setZoom(Number(e.target.value))}/></label><div className="unified-viewport"><div style={{width:width*zoom,height:height*zoom}}><div style={{position:'relative',width,height,transform:`scale(${zoom})`,transformOrigin:'top left'}}>
    <svg width={width} height={height} style={{position:'absolute',inset:0}} aria-hidden="true">{g.edges().map(e=><polyline key={JSON.stringify(e)} points={g.edge(e).points.map((p:{x:number;y:number})=>`${p.x},${p.y}`).join(' ')} fill="none" stroke="#718379" strokeWidth={2}/>)}</svg>
    {model.families.map(f=>{const p=g.node('f:'+f.id);return <span key={f.id} title={f.parents.join(' + ')} style={{position:'absolute',left:p.x-5,top:p.y-5,width:10,height:10,borderRadius:'50%',background:'#c4674d'}}/>;})}
    {model.people.map(name=>{const p=g.node('p:'+name);return <button key={name} className={`person-card${selected===name?' selected':''}`} style={{position:'absolute',left:p.x-92,top:p.y-50,height:100,overflow:'auto'}} onClick={()=>onSelect(name)}><span className="person-name">{name}</span></button>;})}
  </div></div></div></>;
}
