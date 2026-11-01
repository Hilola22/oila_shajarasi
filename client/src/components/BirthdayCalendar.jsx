import { useEffect, useMemo, useState } from 'react';
import { api } from '../api.js';
import { daysLabel, formatDate, fullName } from '../utils.js';
import { Avatar, Empty, ErrorNote } from './common.jsx';

const MAX_PEOPLE = 2;
const NONE = [];

export default function BirthdayCalendar({ members, preselected = NONE }) {
  const withDate = useMemo(() => members.filter((m) => m.birth_date), [members]);
  const [selected, setSelected] = useState(() => preselected.slice(0, MAX_PEOPLE));
  const [links, setLinks] = useState([]);
  const [upcoming, setUpcoming] = useState([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setSelected(preselected.slice(0, MAX_PEOPLE));
  }, [preselected]);

  useEffect(() => {
    api
      .upcoming(6)
      .then((d) => setUpcoming(d.upcoming))
      .catch(() => setUpcoming([]));
  }, [members]);

  // Havolalar oldindan tayyorlanadi, shuning uchun tugma bosilganda brauzer yangi oynani bloklamaydi.
  useEffect(() => {
    let cancelled = false;
    setError('');
    if (selected.length === 0) {
      setLinks([]);
      return undefined;
    }
    api
      .googleLinks(selected)
      .then((d) => !cancelled && setLinks(d.events))
      .catch((err) => {
        if (!cancelled) {
          setLinks([]);
          setError(err.message);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [selected]);

  // Tanlovdan chiqarilgan odamning eskirgan havolasi ko'rinib qolmasligi uchun filtrlanadi.
  const shownLinks = links.filter((l) => selected.includes(l.member_id));

  function toggle(id) {
    setSelected((cur) => {
      if (cur.includes(id)) return cur.filter((x) => x !== id);
      if (cur.length >= MAX_PEOPLE) return [...cur.slice(1), id];
      return [...cur, id];
    });
  }

  async function downloadIcs() {
    setBusy(true);
    setError('');
    try {
      const blob = await api.icsBlob(selected);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'tugilgan-kunlar.ics';
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="calendar-layout">
      <div className="card pad">
        <h3>Tug'ilgan kunni Google Kalendarga qo'shish</h3>
        <p className="muted">
          Bitta yoki ikkita odamni tanlang. Kalendaringiz tug'ilgan kunni har yili <strong>10 yil davomida</strong>{' '}
          eslatib turadi.
        </p>

        {withDate.length === 0 ? (
          <Empty title="Tug'ilgan sanasi kiritilgan a'zo yo'q">
            A'zoni tahrirlab, tug'ilgan sanasini kiriting.
          </Empty>
        ) : (
          <ul className="pick-list">
            {withDate.map((m) => {
              const on = selected.includes(m.id);
              return (
                <li key={m.id}>
                  <label className={`pick ${on ? 'is-on' : ''}`}>
                    <input type="checkbox" checked={on} onChange={() => toggle(m.id)} />
                    <Avatar member={m} size="sm" />
                    <span>
                      <strong>{fullName(m)}</strong>
                      <span className="muted"> · {formatDate(m.birth_date)}</span>
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>
        )}

        <ErrorNote>{error}</ErrorNote>

        {shownLinks.length > 0 && (
          <div className="calendar-actions">
            {shownLinks.map((l) => (
              <a
                key={l.member_id}
                className="btn btn-primary"
                href={l.url}
                target="_blank"
                rel="noopener noreferrer"
              >
                Google Kalendar: {l.name}
              </a>
            ))}
            <button type="button" className="btn" onClick={downloadIcs} disabled={busy}>
              {busy ? 'Tayyorlanmoqda…' : '.ics faylini yuklab olish'}
            </button>
            <p className="hint">
              Birinchi eslatma: {formatDate(shownLinks[0].first_date)}
              {shownLinks.length > 1 && ` va ${formatDate(shownLinks[1].first_date)}`}. Oxirgisi {Math.max(...shownLinks.map((l) => l.last_year))}-yilda.
              Google Kalendar yangi tadbir oynasini ochadi — «Saqlash» tugmasini bosing.
              .ics fayl ikkala odamni birdaniga qo'shadi va eslatmalarni (kundan oldin va kun ertalab) o'zi o'rnatadi.
            </p>
          </div>
        )}
      </div>

      <aside className="card pad">
        <h3>Yaqinlashayotgan tug'ilgan kunlar</h3>
        {upcoming.length === 0 ? (
          <p className="muted">Hozircha ma'lumot yo'q.</p>
        ) : (
          <ul className="upcoming">
            {upcoming.map((u) => (
              <li key={u.id}>
                <div>
                  <strong>
                    {u.first_name} {u.last_name}
                  </strong>
                  <span className="muted">
                    {formatDate(u.next_birthday)} · {u.turning} yosh
                  </span>
                </div>
                <span className={`chip ${u.days_left <= 7 ? 'chip-gold' : ''}`}>{daysLabel(u.days_left)}</span>
              </li>
            ))}
          </ul>
        )}
      </aside>
    </section>
  );
}
