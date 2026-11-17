import { Fragment, useMemo, useState } from 'react';
import { formatMoney, type CardSpec } from '../../core/card';
import { bulkSpecs, cardsOf, hasCardForMonth, memberStats, newMember } from '../../core/members';
import { LANGS, monthName } from '../../i18n';
import { sheetPdf, sheetsPdf } from '../../render/pdf';
import { sheetSvg } from '../../render/sheet';
import { addMember, loadCards, loadMembers, removeMember, saveCards } from '../../store';
import { useApp } from '../ctx';

const CURRENCIES = ['INR', 'USD', 'EUR', 'GBP', 'KES', 'NGN', 'BDT', 'PKR', 'NPR', 'PHP', 'IDR', 'MXN', 'BRL', 'ZAR'];

function save(blob: Blob, name: string) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 3000);
}

export function Members({ newCardFor }: { go: (r: string) => void; newCardFor: (d: Partial<CardSpec>) => void }) {
  const { settings, lang, toast } = useApp();
  const now = new Date();
  const [members, setMembers] = useState(loadMembers());
  const [cards, setCards] = useState(loadCards());
  const [open, setOpen] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [ym, setYm] = useState(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`);
  const [f, setF] = useState({ name: '', employer: '', rate: 500, adv: 100, currency: 'INR', lang: settings.lang });
  const [year, month] = ym.split('-').map(Number);

  const refresh = () => { setMembers(loadMembers()); setCards(loadCards()); };
  const stats = useMemo(() => memberStats(members, cards, year, month), [members, cards, year, month]);
  const missing = useMemo(() => members.filter((m) => !hasCardForMonth(m, cards, year, month)), [members, cards, year, month]);

  const add = () => {
    if (!f.name.trim()) return toast('Enter the member’s name');
    addMember(newMember({ name: f.name, employer: f.employer, rateMinor: Math.round(f.rate * 100), advMinor: Math.round(f.adv * 100), currency: f.currency, lang: f.lang }));
    setF({ ...f, name: '' });
    refresh();
  };

  const bulk = async () => {
    const specs = bulkSpecs(members, cards, year, month);
    if (!specs.length) return toast('Everyone already has a card for this month');
    setBusy(true);
    saveCards(specs);
    try {
      save(await sheetsPdf(specs.map((s) => sheetSvg(s, s.lang))), `tally-cards-${ym}-${specs.length}.pdf`);
      toast(`${specs.length} cards created and saved`);
    } catch {
      toast('Cards saved, but the PDF could not be made');
    }
    setBusy(false);
    refresh();
  };

  return (
    <div>
      <h1 style={{ fontSize: '2rem' }}>Members</h1>
      <p className="muted">The people you create cards for. Add each worker once, then make their card each month in one click, or make everyone’s at once.</p>

      <div className="grid3" style={{ marginBottom: 16 }}>
        <div className="card"><div className="kicker">Members</div><div style={{ fontSize: '2.2rem', fontWeight: 800 }}>{stats.members}</div></div>
        <div className="card"><div className="kicker">Cards created (all time)</div><div style={{ fontSize: '2.2rem', fontWeight: 800 }}>{stats.cards}</div></div>
        <div className="card"><div className="kicker">{monthName(lang, month)} {year}</div><div style={{ fontSize: '2.2rem', fontWeight: 800 }}>{stats.thisMonth}<span className="muted" style={{ fontSize: '1rem' }}> / {stats.members} have a card</span></div></div>
      </div>

      <div className="grid2">
        <div className="card">
          <h3>Add a member</h3>
          <div className="field"><label>Name</label><input value={f.name} maxLength={18} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="e.g. Ramesh" onKeyDown={(e) => e.key === 'Enter' && add()} /></div>
          <div className="field"><label>Employer / contractor</label><input value={f.employer} maxLength={18} onChange={(e) => setF({ ...f, employer: e.target.value })} placeholder="e.g. Sharma Builders" /></div>
          <div className="row">
            <div className="field" style={{ flex: 1 }}><label>Daily wage</label><input type="number" min={0} step="any" value={f.rate} onChange={(e) => setF({ ...f, rate: Number(e.target.value) })} /></div>
            <div className="field" style={{ flex: 1 }}><label>Advance token</label><input type="number" min={0} step="any" value={f.adv} onChange={(e) => setF({ ...f, adv: Number(e.target.value) })} /></div>
          </div>
          <div className="row">
            <div className="field" style={{ flex: 1 }}><label>Currency</label><select value={f.currency} onChange={(e) => setF({ ...f, currency: e.target.value })}>{CURRENCIES.map((c) => <option key={c}>{c}</option>)}</select></div>
            <div className="field" style={{ flex: 1 }}><label>Language</label><select value={f.lang} onChange={(e) => setF({ ...f, lang: e.target.value })}>{LANGS.map((l) => <option key={l.code} value={l.code}>{l.name}</option>)}</select></div>
          </div>
          <button className="primary" onClick={add}>＋ Add member</button>
        </div>

        <div className="card">
          <h3>Create cards for everyone</h3>
          <div className="field"><label>Month</label><input type="month" value={ym} onChange={(e) => setYm(e.target.value)} /></div>
          <p className="sans small">{missing.length === 0 ? (members.length ? '✅ Everyone already has a card for this month.' : 'Add members first.') : <>Missing a card this month: <b>{missing.map((m) => m.name).join(', ')}</b></>}</p>
          <button className="primary" onClick={bulk} disabled={busy || missing.length === 0}>{busy ? <span className="spin" /> : '⬇'} Create {missing.length} card{missing.length === 1 ? '' : 's'} + one PDF</button>
          <p className="small muted sans" style={{ marginTop: 8 }}>Makes one new unique card (own wavy cut) per member, saves them, and downloads a single PDF with one A4 page each. Print at 100% / Actual size.</p>
        </div>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <h3>All members</h3>
        {members.length === 0 ? (
          <p className="muted sans">No members yet. Add the first one above.</p>
        ) : (
          <table className="t">
            <thead><tr><th>Name</th><th>Employer</th><th>Wage</th><th>Cards</th><th>{monthName(lang, month)}</th><th /></tr></thead>
            <tbody>
              {members.map((m) => {
                const mine = cardsOf(m, cards);
                const has = hasCardForMonth(m, cards, year, month);
                return (
                  <Fragment key={m.id}>
                    <tr>
                      <td><b>{m.name}</b></td>
                      <td>{m.employer || '—'}</td>
                      <td>{formatMoney(m.rateMinor, m.currency, lang)}</td>
                      <td><button className="sm ghost" onClick={() => setOpen(open === m.id ? null : m.id)}>{mine.length} {open === m.id ? '▴' : '▾'}</button></td>
                      <td>{has ? <span className="pill ok">✓ has card</span> : <span className="pill warn">no card</span>}</td>
                      <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                        <button className="sm" onClick={() => newCardFor({ worker: m.name, employer: m.employer, rateMinor: m.rateMinor, advMinor: m.advMinor, currency: m.currency, lang: m.lang, year, month })}>＋ Card</button>{' '}
                        <button className="sm ghost" title="Remove member (their saved cards stay)" onClick={() => { if (confirm(`Remove ${m.name}? Their saved cards stay in the Ledger.`)) { removeMember(m.id); refresh(); } }}>✕</button>
                      </td>
                    </tr>
                    {open === m.id && (
                      <tr>
                        <td colSpan={6} style={{ textAlign: 'left', background: 'var(--paper-2)' }}>
                          {mine.length === 0 ? <span className="sans small muted">No cards yet for {m.name}.</span> : (
                            <div className="sans small" style={{ display: 'grid', gap: 4 }}>
                              {mine.map((c) => (
                                <div key={c.id} className="row" style={{ justifyContent: 'space-between' }}>
                                  <span>{monthName(lang, c.month)} {c.year} · <span className="mono">{c.id}</span></span>
                                  <button className="sm" onClick={async () => save(await sheetPdf(sheetSvg(c, c.lang)), `tally-${c.id}.pdf`)}>⬇ PDF</button>
                                </div>
                              ))}
                            </div>
                          )}
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        )}
        <p className="small muted sans" style={{ marginTop: 10 }}>A card belongs to a member when its worker name and employer match, so older cards are counted too.</p>
      </div>
    </div>
  );
}
