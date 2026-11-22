export function dateYear(value: unknown): string {
  if (typeof value !== 'string' && typeof value !== 'number') return '';
  const text = String(value);
  const years = text.match(/\b\d{4}\b/g);
  if (!years || years.length !== 1) return '';
  if (/\bbef(?:ore)?\b/i.test(text)) return `before ${years[0]}`;
  if (/\baft(?:er)?\b/i.test(text)) return `after ${years[0]}`;
  return /about|circa|approx|[~?]/i.test(text) ? `c. ${years[0]}` : years[0];
}

export function lifeYears(facts: unknown): string {
  if (!Array.isArray(facts)) return '';
  const year = (type: string) => {
    const fact = facts.find(f => f?.type === `http://gedcomx.org/${type}`);
    return dateYear(fact?.date?.original || fact?.date?.formal);
  };
  const birth = year('Birth'), death = year('Death');
  return birth || death ? `${birth || '?'}-${death || '?'}` : '';
}
