import {useEffect, useMemo, useRef, useState} from 'react';
import {UnifiedGraph} from './UnifiedTree';
import {gedcomxGraph} from './gedcomxGraph';
import {createRoot} from 'react-dom/client';
import {Download, FolderOpen, Undo2} from 'lucide-react';
import {addCoupleEvent, fictionalDocument, GX, parseGedcomx, personName, renamePerson, serializeGedcomx, type Gedcomx} from './gedcomx';
import '../styles.css';

function Editor() {
  const [data, setData] = useState<Gedcomx>(() => structuredClone(fictionalDocument));
  const [history, setHistory] = useState<Gedcomx[]>([]);
  const [baseline, setBaseline] = useState(() => serializeGedcomx(fictionalDocument));
  const [filename, setFilename] = useState('fictional-family.gedcomx.json');
  const [selected, setSelected] = useState('alex');
  const [name, setName] = useState('Alex Example');
  const [relationshipId, setRelationshipId] = useState('couple-alex-robin');
  const [eventType, setEventType] = useState<'Marriage' | 'Divorce'>('Marriage');
  const [date, setDate] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const openInput = useRef<HTMLInputElement>(null);
  const person = data.persons.find(p => p.id === selected)!;
  const dirty = serializeGedcomx(data) !== baseline || name !== personName(person);
  const couples = data.relationships.filter(r => r.type === GX + 'Couple');
  const relationship = couples.find(r => r.id === relationshipId);
  const graph = useMemo(() => gedcomxGraph(data), [data]);
  function selectPerson(id: string) {
    if(id === selected) return;
    if(name !== personName(person) && !window.confirm('Discard the unapplied name edit?')) return;
    setSelected(id);
    setName(personName(data.persons.find(p => p.id === id)!));
    const couple = couples.find(r => r.person1.resource === '#' + id || r.person2.resource === '#' + id);
    if(couple) setRelationshipId(couple.id);
  }
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {if (dirty) {event.preventDefault(); event.returnValue = '';}};
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);
  function change(next: Gedcomx) {setHistory(items => [...items, data]); setData(next); setError(''); setMessage('');}
  function resolveName(reference: string) {const p = data.persons.find(p => '#' + p.id === reference); return p ? personName(p) : reference;}
  function applyName() {try {change(renamePerson(data, selected, name));} catch(e) {setError(String(e));}}
  function save() {
    try {
      const next = name !== personName(person) ? renamePerson(data, selected, name) : data;
      const text = serializeGedcomx(next);
      const url = URL.createObjectURL(new Blob([text], {type: 'application/json'}));
      const link = document.createElement('a'); link.href = url; link.download = filename; link.click();
      setTimeout(() => URL.revokeObjectURL(url), 10000);
      if(next !== data) change(next);
      setName(personName(next.persons.find(p => p.id === selected)!));
      setMessage('Download requested. Reopen the downloaded file to verify your saved copy.'); setError('');
      // A download request does not confirm the browser actually wrote the file.
    } catch(e) {setError(String(e));}
  }
  return <main className="app gx-editor">
    <header className="page-header"><div><p className="eyebrow">Family Tree</p><h1>Family document</h1></div><a href="/">Tree viewer</a></header>
    <div className="graph-toolbar">
      <button type="button" onClick={() => openInput.current?.click()}><FolderOpen size={18}/> Open</button>
      <button type="button" onClick={save}><Download size={18}/> Save copy</button>
      <button type="button" title="Undo last applied change" aria-label="Undo last applied change" disabled={!history.length} onClick={() => {const previous = history[history.length - 1]; setData(previous); setName(personName(previous.persons.find(p => p.id === selected)!)); setHistory(history.slice(0, -1)); setMessage('');}}><Undo2 size={18}/></button>
      <span>{filename} · {dirty ? 'Unsaved changes' : 'Unchanged'}</span>
      <input hidden ref={openInput} type="file" accept=".json,application/json,application/x-gedcomx-v1+json" onChange={async event => {
        const file = event.target.files?.[0]; event.target.value = ''; if(!file) return;
        try {
          const next = parseGedcomx(await file.text());
          if(dirty && !window.confirm('Discard unsaved changes and open this file?')) return;
          setData(next); setBaseline(serializeGedcomx(next)); setHistory([]); setFilename(file.name);
          setSelected(next.persons[0].id); setName(personName(next.persons[0]));
          setRelationshipId(next.relationships.find(r => r.type === GX + 'Couple')?.id || '');
          setDate(''); setError(''); setMessage('File opened.');
        } catch(e) {setError(String(e));}
      }}/>
    </div>
    {error && <p role="alert" className="error">{error}</p>}
    <p role="status">{message}</p>
    <div className="gx-columns">
      <section><h2>Person</h2>
        <label>Person<select value={selected} onChange={event => selectPerson(event.target.value)}>{data.persons.map(p => <option key={p.id} value={p.id}>{personName(p)} ({p.id})</option>)}</select></label>
        <form onSubmit={event => {event.preventDefault(); applyName();}}><label>Name<input value={name} required onChange={event => setName(event.target.value)}/></label><button type="submit" disabled={name === personName(person)}>Apply name</button></form>
      </section>
      <section><h2>Partnership history</h2>
        <label>Couple<select value={relationshipId} onChange={event => setRelationshipId(event.target.value)} disabled={!couples.length}>{!couples.length && <option value="">No couples recorded</option>}{couples.map(r => <option key={r.id} value={r.id}>{resolveName(r.person1.resource)} + {resolveName(r.person2.resource)} ({r.id})</option>)}</select></label>
        <ol>{relationship?.facts?.map((fact, index) => <li key={index}>{fact.type.startsWith(GX) ? fact.type.slice(GX.length) : fact.type}: {fact.date?.original || 'Date unknown'}</li>)}</ol>
        <form onSubmit={event => {event.preventDefault(); try {change(addCoupleEvent(data, relationshipId, eventType, date));setDate('');} catch(e) {setError(String(e));}}}>
          <label>Event<select value={eventType} onChange={event => setEventType(event.target.value as 'Marriage' | 'Divorce')}><option>Marriage</option><option>Divorce</option></select></label>
          <label>Date<input value={date} placeholder="e.g. 2000 or about June 2000" onChange={event => setDate(event.target.value)}/></label>
          <button type="submit" disabled={!relationship}>Add event</button>
        </form>
      </section>
    </div>
    <section aria-label="Document tree"><h2>Family tree</h2><UnifiedGraph model={graph} selected={selected} onSelect={selectPerson}/></section>
  </main>;
}
createRoot(document.getElementById('root')!).render(<Editor/>);
