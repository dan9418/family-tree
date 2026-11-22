import {useEffect, useLayoutEffect, useMemo, useRef, useState} from 'react';
import {Focus, Maximize, Search, Expand, Shrink} from 'lucide-react';
import {dateYear} from './years';
import {unifiedLayout, displayEdges} from './unifiedLayout';
import {relationships, type FamilyData, type RelationshipGraph} from './relationships';

export function UnifiedTree({data, selected, onSelect}: {
  data: FamilyData;
  selected: string;
  onSelect: (name: string) => void;
}) {
  const model = useMemo(() => relationships(data), [data]);
  return <UnifiedGraph model={model} selected={selected} onSelect={onSelect}/>;
}

export function UnifiedGraph({model, selected, onSelect, onSelectRelationship}: {
  model: RelationshipGraph;
  selected: string;
  onSelect: (id: string) => void;
  onSelectRelationship?: (id: string) => void;
}) {
  const displayName = (id: string) => model.labels?.[id] || id;
  const [zoom, setZoom] = useState(1);
  const [query, setQuery] = useState('');
  type Trace = {kind:'person'|'family';id:string};
  const [hovered, setHovered] = useState<Trace | null>(null);
  const [focused, setFocused] = useState<Trace | null>(null);
  const [centerRequest, requestCenter] = useState(0);
  const viewport = useRef<HTMLDivElement>(null);
  const viewer = useRef<HTMLDivElement>(null);
  const [fullscreen, setFullscreen] = useState(false);
  const [fullscreenError, setFullscreenError] = useState('');
  useEffect(() => {
    const changed = () => setFullscreen(document.fullscreenElement === viewer.current);
    document.addEventListener('fullscreenchange', changed);
    return () => document.removeEventListener('fullscreenchange', changed);
  }, []);
  async function toggleFullscreen() {
    try {
      setFullscreenError('');
      if (document.fullscreenElement === viewer.current) await document.exitFullscreen();
      else await viewer.current?.requestFullscreen();
    } catch {setFullscreenError('Fullscreen is unavailable in this browser.');}
  }
  const pendingCenter = useRef<string | null>(null);
  const layout = useMemo(() => unifiedLayout(model), [model]);
  const {nodes, edges, width, height} = layout;
  const strokes = useMemo(() => displayEdges(edges), [edges]);
  const trace = hovered || focused;
  const tracedGroups = layout.parentGroups.filter(group => trace && (trace.kind === 'person'
    ? group.parents.includes(trace.id) || group.children.includes(trace.id)
    : group.partnershipId === trace.id));
  const groupIds = new Set(tracedGroups.map(group => group.id));
  const familyIds = new Set(tracedGroups.flatMap(group => group.partnershipId ? [group.partnershipId] : []));
  if(trace?.kind === 'family') familyIds.add(trace.id);
  if(trace?.kind === 'person') model.families.filter(f => f.parents.includes(trace.id) || f.children.includes(trace.id)).forEach(f => familyIds.add(f.id));
  const highlighted = trace ? displayEdges(edges.filter(edge => groupIds.has(edge.groupId || '') || familyIds.has(edge.relationshipId || ''))) : [];
  useEffect(() => {setHovered(null); setFocused(null);}, [model]);

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

  return <div className="tree-viewer" ref={viewer}>
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
      <button type="button" className="graph-tool" title={fullscreen ? 'Exit fullscreen' : 'Enter fullscreen'} aria-label={fullscreen ? 'Exit fullscreen' : 'Enter fullscreen'} onClick={toggleFullscreen}>{fullscreen ? <Shrink size={20}/> : <Expand size={20}/>}</button>
    </div>
    {fullscreenError && <p role="alert">{fullscreenError}</p>}
    <div className="unified-viewport" ref={viewport} tabIndex={0} aria-label="Unified family tree">
      <div style={{width: width * zoom, height: height * zoom, position: 'relative', overflow: 'hidden'}}>
        <div style={{position: 'relative', width, height, transform: `scale(${zoom})`, transformOrigin: 'top left'}}>
          <svg width={width} height={height} style={{position: 'absolute', inset: 0}} aria-hidden="true">
            <g opacity={highlighted.length ? 0.18 : 1}>
            {strokes.map(edge => <polyline key={edge.id} data-edge-kind={edge.kind} points={edge.points.map(p=>`${p.x},${p.y}`).join(' ')} fill="none" stroke={edge.kind==='partner'?'#b56344':'#427385'} strokeDasharray={edge.kind==='partner'?'6 3':undefined} strokeWidth={2}/>)}
            </g>
            {highlighted.map(edge => <polyline key={'halo:'+edge.id} pointerEvents="none" points={edge.points.map(p=>`${p.x},${p.y}`).join(' ')} fill="none" stroke="#f5faf8" strokeWidth={7} vectorEffect="non-scaling-stroke"/>)}
            {highlighted.map(edge => <g key={edge.id} data-highlighted-edge={edge.kind} pointerEvents="none">
              <polyline points={edge.points.map(p=>`${p.x},${p.y}`).join(' ')} fill="none" stroke={edge.kind==='partner'?'#a74720':'#175b76'} strokeDasharray={edge.kind==='partner'?'6 3':undefined} strokeWidth={3} vectorEffect="non-scaling-stroke"/>
            </g>)}
          </svg>
          {model.families.map(family => {
            const point = nodes.get('f:' + family.id);
            if(!point) return null;
            if (family.parents.length>1) return <div key={family.id} className="relationship-node" data-relationship-id={family.id}
              onMouseEnter={() => setHovered({kind:'family',id:family.id})} onMouseLeave={() => setHovered(null)}
              onFocus={() => setFocused({kind:'family',id:family.id})} onBlur={() => setFocused(null)}
              title={(family.events || []).join('\n')}
              role={onSelectRelationship ? 'button' : undefined} tabIndex={onSelectRelationship ? 0 : undefined}
              aria-label={onSelectRelationship ? `Edit partnership: ${family.parents.map(displayName).join(' + ')}` : undefined}
              onClick={() => onSelectRelationship?.(family.id)} onKeyDown={event => {if(onSelectRelationship && (event.key==='Enter'||event.key===' ')){event.preventDefault();onSelectRelationship(family.id);}}}
              style={{position:'absolute',left:point.x-point.width/2,top:point.y-point.height/2,width:point.width,height:point.height,overflow:'auto'}}>
              <strong>{family.label}</strong>
              <div className="partnership-years">{family.events?.length ? family.events.map(event => dateYear(event) || '?').join(' / ') : 'Year unknown'}</div>
            </div>;
            return <span key={family.id} data-relationship-id={family.id} hidden/>;
          })}
          {model.people.map(name => {
            const point = nodes.get('p:' + name)!;
            return <button type="button" key={name} data-person-id={name} className={`person-card${selected === name ? ' selected' : ''}`} aria-pressed={selected === name}
              onMouseEnter={() => setHovered({kind:'person',id:name})} onMouseLeave={() => setHovered(null)}
              onFocus={() => setFocused({kind:'person',id:name})} onBlur={() => setFocused(null)}
              style={{position: 'absolute', left: point.x - 92, top: point.y - 50, width: 184, height: 100, overflow: 'auto'}} onClick={() => onSelect(name)}>
              <span className="person-name">{displayName(name)}</span>
              {model.years?.[name] && <span className="person-years">{model.years[name]}</span>}
            </button>;
          })}
        </div>
      </div>
    </div>
  </div>;
}
