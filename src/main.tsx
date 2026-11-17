import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import example from '../family-tree.template.json';
import '../styles.css';

type Data = {root:string; parents:Record<string,string[]>; partners:string[][]; details?:Record<string,{born?:string|number;died?:string|number;notes?:string}>};
type Family = {parents:string[];children:string[]};
type Model = {people:Set<string>;rootFamilies:Family[];familyMap:Map<string,Family>;partnerMap:Map<string,string[]>};
declare const FamilyLayout: {buildHybridTreeModel(d:Data):Model;getFamilyKey(p:string[]):string;buildPartnerMap(d:Data,o:{inferCoparents:boolean}):Map<string,string[]>};
function validate(value:unknown):Data {
  const d=value as Data;
  if(!d || typeof d.root!=='string' || !d.parents || typeof d.parents!=='object' || Array.isArray(d.parents) || !Array.isArray(d.partners)) throw Error('Invalid family JSON');
  for(const p of [...Object.values(d.parents),...d.partners]) if(!Array.isArray(p)||p.some(n=>typeof n!=='string')) throw Error('Names must be strings');
  return d;
}
function App({initial}:{initial:Data}) {
  const [data,setData]=useState(initial), [selected,select]=useState(initial.root), [error,setError]=useState('');
  const model=FamilyLayout.buildHybridTreeModel(data), expanded=new Set<string>();
  function PersonCard({name}:{name:string}) {
    const d=data.details?.[name];
    return <button type="button" className={`person-card${name===data.root?' root-card':''}${name===selected?' selected':''}`} onClick={()=>select(name)}><span className="person-name">{name}</span><span className="person-years">{d?.born||d?.died?`${d.born||'?'} - ${d.died||''}`:'Dates unknown'}</span></button>;
  }
  function couple(names:string[],label:string) {return <div className="couple-node"><div className="couple-cards">{names.map(n=><PersonCard key={n} name={n}/>)}</div><div className="couple-label">{label}</div></div>;}
  function family(f:Family):React.ReactNode {
    const key=FamilyLayout.getFamilyKey(f.parents); expanded.add(key);
    return <section className="family-tree" key={key}><div className="family-parents">{couple(f.parents,'Parents')}</div>{!!f.children.length&&<><div className="family-connector"/><div className="family-children">{f.children.map(n=><div className="child-unit" key={n}>{child(n)}</div>)}</div></>}</section>;
  }
  function child(n:string):React.ReactNode {
    const partner=model.partnerMap.get(n)?.[0], f=partner?model.familyMap.get(FamilyLayout.getFamilyKey([n,partner])):undefined;
    if(f) return expanded.has(FamilyLayout.getFamilyKey(f.parents))?<div className="family-reference"><span className="reference-title">{n} + {partner}</span><span className="reference-label">Family shown elsewhere</span></div>:family(f);
    return partner?couple([n,partner],'Partner'):<PersonCard name={n}/>;
  }
  const d=data.details?.[selected];
  const rows={Name:selected,Born:d?.born||'Unknown',Died:d?.died||'Unknown',Parents:data.parents[selected]?.join(', ')||'Unknown',Partners:FamilyLayout.buildPartnerMap(data,{inferCoparents:true}).get(selected)?.join(', ')||'None listed',Children:Object.entries(data.parents).filter(([,p])=>p.includes(selected)).map(([n])=>n).join(', ')||'None listed',...(d?.notes?{Notes:d.notes}:{})};
  return <main className="app"><header className="page-header"><div><p className="eyebrow">Family Tree</p><h1>{data.root}</h1></div><div className="summary">{model.people.size} people - {Object.keys(data.parents).length} parent links</div></header><label>Open JSON <input type="file" accept=".json,application/json" onChange={async e=>{const f=e.target.files?.[0];if(!f)return;try{const next=validate(JSON.parse(await f.text()));FamilyLayout.buildHybridTreeModel(next);setData(next);select(next.root);setError('');}catch(err){setError(String(err));}e.target.value='';}}/></label>{error&&<p role="alert">{error}</p>}<section className="tree-shell" aria-label="Family tree visualization"><div className="tree"><div className="hybrid-forest">{model.rootFamilies.map(family)}</div></div></section><section className="details-panel"><h2>Selected Person</h2><div className="person-details">{Object.entries(rows).map(([k,v])=><div className="detail-row" key={k}><div className="detail-label">{k}</div><div>{v}</div></div>)}</div></section></main>;
}
async function start(){let data:Data=example;try{const response=await fetch('/family-tree.json',{cache:'no-store'});if(response.ok&&response.headers.get('content-type')?.includes('application/json')) data=validate(await response.json());}catch{ /* Use the fictional template when no local file is available. */ }createRoot(document.getElementById('root')!).render(<App initial={data}/>);}
void start();
