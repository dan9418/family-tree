import {useLayoutEffect, useMemo, useRef, useState} from 'react';
import {Focus, Maximize, Search} from 'lucide-react';
import dagre from '@dagrejs/dagre';
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
  const layout = useMemo(() => {
    const g = new dagre.graphlib.Graph();
    g.setGraph({rankdir: 'TB', nodesep: 35, ranksep: 55, marginx: 25, marginy: 25});
    g.setDefaultEdgeLabel(() => ({}));
    model.people.forEach(name => g.setNode('p:' + name, {width: 184, height: 100}));
    model.families.forEach(family => {
      const id = 'f:' + family.id;
      g.setNode(id, {width: family.label ? 240 : 12, height: family.label ? 44 + (family.events?.length || 0) * 44 : 12});
      family.parents.forEach(name => g.setEdge('p:' + name, id));
      family.children.forEach(name => g.setEdge(id, 'p:' + name));
    });
    dagre.layout(g);
    return {model, g};
  }, [model]);
  const {g} = layout;
  const width = g.graph().width || 100, height = g.graph().height || 100;

  useLayoutEffect(() => {
    if (!pendingCenter.current || !viewport.current) return;
    const point = g.node('p:' + pendingCenter.current);
    pendingCenter.current = null;
    if (point) viewport.current.scrollTo({
      left: point.x * zoom - viewport.current.clientWidth / 2,
      top: point.y * zoom - viewport.current.clientHeight / 2
    });
  }, [g, zoom, centerRequest]);

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
            {g.edges().map(edge => <polyline key={JSON.stringify(edge)} points={g.edge(edge).points.map((p: {x: number; y: number}) => `${p.x},${p.y}`).join(' ')} fill="none" stroke="#718379" strokeWidth={2}/>)}
          </svg>
          {model.families.map(family => {
            const point = g.node('f:' + family.id);
            if (family.label) return <div key={family.id} className="relationship-node" data-relationship-id={family.id}
              style={{position:'absolute',left:point.x-120,top:point.y-point.height/2,width:240,height:point.height,overflow:'auto'}}>
              <strong>{family.label}</strong>
              {family.events?.map((event,index) => <div key={index}>{event}</div>)}
            </div>;
            return <span key={family.id} title={family.parents.join(' + ')} style={{position: 'absolute', left: point.x - 5, top: point.y - 5, width: 10, height: 10, borderRadius: '50%', background: '#c4674d'}}/>;
          })}
          {model.people.map(name => {
            const point = g.node('p:' + name);
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
