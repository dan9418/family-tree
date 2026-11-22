import {useEffect, useMemo, useRef, useState} from 'react';
import {UnifiedGraph} from './UnifiedTree';
import {gedcomxGraph} from './gedcomxGraph';
import {createRoot} from 'react-dom/client';
import {Download, FolderOpen, Undo2, X} from 'lucide-react';
import {addCoupleEvent, fictionalDocument, GX, parseGedcomx, personName, personDate, updatePersonDates, renamePerson, serializeGedcomx, type Gedcomx, type Person} from './gedcomx';
import '../styles.css';

function Editor({initial, initialFilename}: {initial: Gedcomx; initialFilename: string}) {
  const [data, setData] = useState<Gedcomx>(() => structuredClone(initial));
  const [history, setHistory] = useState<Gedcomx[]>([]);
  const [baseline, setBaseline] = useState(() => serializeGedcomx(initial));
  const [filename, setFilename] = useState(initialFilename);
  const [selected, setSelected] = useState(initial.persons[0].id);
  const [name, setName] = useState(personName(initial.persons[0]));
  const [birth, setBirth] = useState(personDate(initial.persons[0], 'Birth'));
  const [death, setDeath] = useState(personDate(initial.persons[0], 'Death'));
  function resetDates(p: Person) {setBirth(personDate(p, 'Birth')); setDeath(personDate(p, 'Death'));}
  const [relationshipId, setRelationshipId] = useState(initial.relationships.find(r => r.type === GX + 'Couple')?.id || '');
  const [eventType, setEventType] = useState<'Marriage' | 'Divorce'>('Marriage');
  const [date, setDate] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const openInput = useRef<HTMLInputElement>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const nameInput = useRef<HTMLInputElement>(null);
  const eventInput = useRef<HTMLSelectElement>(null);
  function closeDialog() {
    if ((name !== personName(person) || datesChanged || date.trim()) && !window.confirm('Discard unapplied edits?')) return;
    setName(personName(person)); resetDates(person); setDate(''); setError('');
    dialog.current?.close();
  }
  function openPerson(id: string) {
    selectPerson(id);
    dialog.current?.showModal();
    nameInput.current?.focus();
  }
  function openPartnership(id: string) {
    const couple = data.relationships.find(r => r.id === id);
    if(!couple) return;
    selectPerson(couple.person1.resource.slice(1));
    setRelationshipId(id);
    dialog.current?.showModal();
    eventInput.current?.focus();
  }
  const person = data.persons.find(p => p.id === selected)!;
  const datesChanged = birth !== personDate(person, 'Birth') || death !== personDate(person, 'Death');
  const dirty = serializeGedcomx(data) !== baseline || name !== personName(person) || datesChanged || !!date.trim();
  const couples = data.relationships.filter(r => r.type === GX + 'Couple');
  const relationship = couples.find(r => r.id === relationshipId);
  const graph = useMemo(() => gedcomxGraph(data), [data]);
  function selectPerson(id: string) {
    if(id === selected) return;
    if((name !== personName(person) || datesChanged) && !window.confirm('Discard unapplied person edits?')) return;
    setSelected(id);
    setName(personName(data.persons.find(p => p.id === id)!));
    resetDates(data.persons.find(p => p.id === id)!);
    setError('');
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
      let next = name !== personName(person) ? renamePerson(data, selected, name) : data;
      if (datesChanged) next = updatePersonDates(next, selected, birth, death);
      const text = serializeGedcomx(next);
      const url = URL.createObjectURL(new Blob([text], {type: 'application/json'}));
      const link = document.createElement('a'); link.href = url; link.download = filename; link.click();
      setTimeout(() => URL.revokeObjectURL(url), 10000);
      if(next !== data) change(next);
      setName(personName(next.persons.find(p => p.id === selected)!));
      resetDates(next.persons.find(p => p.id === selected)!);
      setMessage('Download requested. Reopen the downloaded file to verify your saved copy.'); setError('');
      // A download request does not confirm the browser actually wrote the file.
    } catch(e) {setError(String(e));}
  }
  return <main className="app gx-editor">
    <header className="page-header"><div><p className="eyebrow">Family Tree</p><h1>Family document</h1></div><a href="/?legacy">Legacy viewer</a></header>
    <div className="graph-toolbar">
      <button type="button" onClick={() => openInput.current?.click()}><FolderOpen size={18}/> Open</button>
      <button type="button" onClick={save}><Download size={18}/> Save copy</button>
      <button type="button" title="Undo last applied change" aria-label="Undo last applied change" disabled={!history.length} onClick={() => {const previous = history[history.length - 1]; setData(previous); setName(personName(previous.persons.find(p => p.id === selected)!)); resetDates(previous.persons.find(p => p.id === selected)!); setHistory(history.slice(0, -1)); setMessage('');}}><Undo2 size={18}/></button>
      <span>{filename} · {dirty ? 'Unsaved changes' : 'Unchanged'}</span>
      <input hidden ref={openInput} type="file" accept=".json,application/json,application/x-gedcomx-v1+json" onChange={async event => {
        const file = event.target.files?.[0]; event.target.value = ''; if(!file) return;
        try {
          const next = parseGedcomx(await file.text());
          if(dirty && !window.confirm('Discard unsaved changes and open this file?')) return;
          setData(next); setBaseline(serializeGedcomx(next)); setHistory([]); setFilename(file.name);
          setSelected(next.persons[0].id); setName(personName(next.persons[0]));
          resetDates(next.persons[0]);
          setRelationshipId(next.relationships.find(r => r.type === GX + 'Couple')?.id || '');
          setDate(''); setError(''); setMessage('File opened.');
        } catch(e) {setError(String(e));}
      }}/>
    </div>
    {error && <p role="alert" className="error">{error}</p>}
    <p role="status">{message}</p>
    <dialog ref={dialog} className="edit-dialog" aria-labelledby="edit-dialog-title" onCancel={event => {event.preventDefault();closeDialog();}}>
    <header className="dialog-header"><h2 id="edit-dialog-title">Edit family details</h2><button type="button" title="Close editor" aria-label="Close editor" onClick={closeDialog}><X size={20}/></button></header>
    {error && <p role="alert" className="error">{error}</p>}
    <div className="gx-columns">
      <section><h2>Person</h2>
        <label>Person<select aria-label="Person" value={selected} onChange={event => selectPerson(event.target.value)}>{data.persons.map(p => <option key={p.id} value={p.id}>{personName(p)} ({p.id})</option>)}</select></label>
        <form onSubmit={event => {event.preventDefault(); applyName();}}><label>Name<input ref={nameInput} value={name} required onChange={event => setName(event.target.value)}/></label><button type="submit" disabled={name === personName(person)}>Apply name</button></form>
        <form onSubmit={event => {event.preventDefault(); try {const next = updatePersonDates(data, selected, birth, death); change(next); resetDates(next.persons.find(p => p.id === selected)!);} catch(e) {setError(String(e));}}}>
          <label>Birth date<input value={birth} placeholder="e.g. 1950" onChange={event => setBirth(event.target.value)}/></label>
          <label>Death date<input value={death} placeholder="e.g. 2026" onChange={event => setDeath(event.target.value)}/></label>
          <button type="submit" disabled={!datesChanged}>Apply dates</button>
        </form>
      </section>
      <section><h2>Partnership history</h2>
        <label>Couple<select value={relationshipId} onChange={event => setRelationshipId(event.target.value)} disabled={!couples.length}>{!couples.length && <option value="">No couples recorded</option>}{couples.map(r => <option key={r.id} value={r.id}>{resolveName(r.person1.resource)} + {resolveName(r.person2.resource)} ({r.id})</option>)}</select></label>
        <ol>{relationship?.facts?.map((fact, index) => <li key={index}>{fact.type.startsWith(GX) ? fact.type.slice(GX.length) : fact.type}: {fact.date?.original || 'Date unknown'}</li>)}</ol>
        <form onSubmit={event => {event.preventDefault(); try {change(addCoupleEvent(data, relationshipId, eventType, date));setDate('');} catch(e) {setError(String(e));}}}>
          <label>Event<select ref={eventInput} value={eventType} onChange={event => setEventType(event.target.value as 'Marriage' | 'Divorce')}><option>Marriage</option><option>Divorce</option></select></label>
          <label>Date<input value={date} placeholder="e.g. 2000 or about June 2000" onChange={event => setDate(event.target.value)}/></label>
          <button type="submit" disabled={!relationship}>Add event</button>
        </form>
      </section>
    </div>
    </dialog>
    <section aria-label="Document tree"><h2>Family tree</h2><UnifiedGraph model={graph} selected={selected} onSelect={openPerson} onSelectRelationship={openPartnership}/></section>
  </main>;
}
async function startEditor() {
  const root = createRoot(document.getElementById('root')!);
  let initial = fictionalDocument;
  let initialFilename = 'fictional-family.gedcomx.json';
  try {
    if (!new URLSearchParams(location.search).has('demo')) {
      const response = await fetch('/family-tree.gedcomx.json', {cache: 'no-store'});
      if (response.ok && response.headers.get('content-type')?.includes('application/json')) {
        initial = parseGedcomx(await response.text());
        initialFilename = 'family-tree.gedcomx.json';
      } else if (!response.ok && response.status !== 404) {
        throw Error(`Could not load the local document (${response.status}).`);
      }
    }
    root.render(<Editor initial={initial} initialFilename={initialFilename}/>);
  } catch (error) {
    root.render(<main className="app"><p role="alert">{String(error)}</p><a href="/?demo">Open fictional example</a></main>);
  }
}
void startEditor();
