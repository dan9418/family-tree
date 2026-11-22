import {useLayoutEffect, useMemo, useRef, useState} from 'react';
import {Focus, Maximize, Search} from 'lucide-react';
import {unifiedLayout} from './unifiedLayout';
import {relationships, type FamilyData, type RelationshipGraph} from './relationships';

export function UnifiedTree({data, selected, onSelect}: {
  data: FamilyData;
  selected: string;
  onSelect: (name: string) => void;
}) {
  const model = useMemo(() => relationships(data), [data]);
  return <UnifiedGraph model={model} selected={selected} onSelect={onSelect}/>;
}

export function UnifiedGraph({model, selected, onSelect}: {
  model: RelationshipGraph;
  selected: string;
  onSelect: (id: string) => void;
}) {
  const displayName = (id: string) => model.labels?.[id] || id;
  const [zoom, setZoom] = useState(1);
  const [query, setQuery] = useState('');
  const [centerRequest, requestCenter] = useState(0);
  const viewport = useRef<HTMLDivElement>(null);
  const pendingCenter = useRef<string | null>(null);
  const layout = useMemo(() => unifiedLayout(model), [model]);
  const {nodes, edges, width, height} = layout;

  useLayoutEffect(() => {
    if (!pendingCenter.current || !viewport.current) return;
    const point = nodes.get('p:' + pendingCenter.current);
    pendingCenter.current = null;
    if (point) viewport.current.scrollTo({
      left: point.x * zoom - viewport.current.clientWidth / 2,
      top: point.y * zoom - viewport.current.clientHeight / 2
    });
  }, [nodes, zoom, centerRequest]);

  function center(name: string) {
    pendingCenter.current = name;
    requestCenter(value => value + 1);
  }
  function fit() {
    const element = viewport.current;
    if (!element) return;
    pendingCenter.current = null;
    setZoom(Math.max(0.05, Math.min(1, element.clientWidth / width, element.clientHeight / height)));
    element.scrollTo({left: 0, top: 0});
  }
  const matches = query.trim()
    ? model.people.filter(name => displayName(name).toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()))
    : [];

  return <>
    <div className="graph-toolbar">
      <div className="graph-search">
        <label className="search-field"><Search size={18} aria-hidden="true"/>
          <input type="search" aria-label="Find a person" placeholder="Find a person" value={query}
            onChange={event => setQuery(event.target.value)} onKeyDown={event => {
              if (event.key === 'Escape') setQuery('');
              if (event.key === 'Enter' && matches.length === 1) {
                onSelect(matches[0]); center(matches[0]); setQuery('');
              }
            }}/>
        </label>
        {query.trim() && <div className="search-results" aria-label="Matching people">
          {matches.length ? matches.map(name => <button type="button" key={name} onClick={() => {
            onSelect(name); center(name); setQuery('');
          }}>{displayName(name)}{model.labels ? ` (${name})` : ''}</button>) : <p role="status">No matches</p>}
        </div>}
      </div>
      <label className="zoom-control">Zoom <input aria-label="Zoom" type="range" min="0.05" max="1.5" step="0.01" value={zoom}
        onChange={event => {pendingCenter.current = selected; setZoom(Number(event.target.value));}}/>
        <output>{Math.round(zoom * 100)}%</output>
      </label>
      <button type="button" className="graph-tool" title="Center selected person" aria-label="Center selected person" onClick={() => center(selected)}><Focus size={20}/></button>
      <button type="button" className="graph-tool" title="Fit entire tree" aria-label="Fit entire tree" onClick={fit}><Maximize size={20}/></button>
    </div>
    <div className="unified-viewport" ref={viewport} tabIndex={0} aria-label="Unified family tree">
      <div style={{width: width * zoom, height: height * zoom, position: 'relative', overflow: 'hidden'}}>
        <div style={{position: 'relative', width, height, transform: `scale(${zoom})`, transformOrigin: 'top left'}}>
          <svg width={width} height={height} style={{position: 'absolute', inset: 0}} aria-hidden="true">
            {edges.map(edge => <g key={edge.id}><polyline points={edge.points.map(p=>`${p.x},${p.y}`).join(' ')} fill="none" stroke="#f5faf8" strokeWidth={6}/><polyline data-edge-kind={edge.kind} points={edge.points.map(p=>`${p.x},${p.y}`).join(' ')} fill="none" stroke={edge.kind==='partner'?'#b56344':'#427385'} strokeDasharray={edge.kind==='partner'?'6 3':undefined} strokeWidth={2}/></g>)}
          </svg>
          {model.families.map(family => {
            const point = nodes.get('f:' + family.id);
            if(!point) return null;
            if (family.parents.length>1) return <div key={family.id} className="relationship-node" data-relationship-id={family.id}
              style={{position:'absolute',left:point.x-point.width/2,top:point.y-point.height/2,width:point.width,height:point.height,overflow:'auto'}}>
              <strong>{family.label}</strong>
              {family.events?.map((event,index) => <div key={index}>{event}</div>)}
            </div>;
            return <span key={family.id} data-relationship-id={family.id} title={[family.label,...(family.events||[])].join(' · ')} style={{position: 'absolute', left: point.x - 4, top: point.y - 4, width: 8, height: 8, borderRadius: '50%', background: '#427385'}}/>;
          })}
          {model.people.map(name => {
            const point = nodes.get('p:' + name)!;
            return <button type="button" key={name} data-person-id={name} className={`person-card${selected === name ? ' selected' : ''}`} aria-pressed={selected === name}
              style={{position: 'absolute', left: point.x - 92, top: point.y - 50, width: 184, height: 100, overflow: 'auto'}} onClick={() => onSelect(name)}>
              <span className="person-name">{displayName(name)}</span>
            </button>;
          })}
        </div>
      </div>
    </div>
  </>;
}
