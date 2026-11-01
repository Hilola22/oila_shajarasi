import { useMemo, useState } from 'react';
import { ageOf, fullName, lifeSpan } from '../utils.js';
import { Avatar, Empty } from './common.jsx';

export default function MemberList({ members, onSelect, canEdit, onAdd }) {
  const [query, setQuery] = useState('');
  const [gender, setGender] = useState('all');
  const [status, setStatus] = useState('all');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return members.filter((m) => {
      if (gender !== 'all' && m.gender !== gender) return false;
      if (status === 'alive' && m.death_date) return false;
      if (status === 'dead' && !m.death_date) return false;
      if (!q) return true;
      return [m.first_name, m.last_name, m.middle_name, m.birth_place, m.occupation]
        .filter(Boolean)
        .some((v) => v.toLowerCase().includes(q));
    });
  }, [members, query, gender, status]);

  return (
    <section>
      <div className="toolbar">
        <input
          className="search"
          type="search"
          placeholder="Ism, familiya, shahar yoki kasb bo'yicha qidirish…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Qidirish"
        />
        <select value={gender} onChange={(e) => setGender(e.target.value)} aria-label="Jins">
          <option value="all">Barcha jins</option>
          <option value="erkak">Erkaklar</option>
          <option value="ayol">Ayollar</option>
        </select>
        <select value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Holati">
          <option value="all">Hammasi</option>
          <option value="alive">Hayot</option>
          <option value="dead">Vafot etgan</option>
        </select>
        {canEdit && (
          <button type="button" className="btn btn-primary" onClick={onAdd}>
            + A'zo qo'shish
          </button>
        )}
      </div>

      <p className="count">
        {filtered.length} / {members.length} ta a'zo
      </p>

      {filtered.length === 0 ? (
        <Empty title="Hech narsa topilmadi">Qidiruv yoki filtrni o'zgartirib ko'ring.</Empty>
      ) : (
        <ul className="member-grid">
          {filtered.map((m) => {
            const age = ageOf(m);
            return (
              <li key={m.id}>
                <button type="button" className="member-card card" onClick={() => onSelect(m.id)}>
                  <Avatar member={m} size="lg" />
                  <span className="member-card-text">
                    <strong>{fullName(m)}</strong>
                    <span className="muted">{lifeSpan(m) || "Sana kiritilmagan"}</span>
                    <span className="chips">
                      <span className={`chip ${m.gender === 'ayol' ? 'chip-rose' : 'chip-teal'}`}>
                        {m.gender === 'ayol' ? 'Ayol' : 'Erkak'}
                      </span>
                      {age !== null && !m.death_date && <span className="chip">{age} yosh</span>}
                      {m.death_date && <span className="chip chip-gray">Vafot etgan</span>}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
