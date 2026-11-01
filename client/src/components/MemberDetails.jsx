import { useState } from 'react';
import { ageOf, formatDate, fullNameWithPatronymic, fullName } from '../utils.js';
import { Avatar, ErrorNote } from './common.jsx';

function Row({ label, children }) {
  if (!children) return null;
  return (
    <div className="detail-row">
      <dt>{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

export default function MemberDetails({
  member,
  members,
  canEdit,
  onSelect,
  onEdit,
  onAddChild,
  onAddSpouse,
  onDelete,
  onCalendar,
}) {
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState('');
  const byId = new Map(members.map((m) => [m.id, m]));
  const father = member.father_id ? byId.get(member.father_id) : null;
  const mother = member.mother_id ? byId.get(member.mother_id) : null;
  const spouse = member.spouse_id ? byId.get(member.spouse_id) : null;
  const children = members.filter((m) => m.father_id === member.id || m.mother_id === member.id);
  const siblings = members.filter(
    (m) =>
      m.id !== member.id &&
      ((member.father_id && m.father_id === member.father_id) ||
        (member.mother_id && m.mother_id === member.mother_id)),
  );
  const age = ageOf(member);

  const link = (m) => (
    <button type="button" className="link" onClick={() => onSelect(m.id)} key={m.id}>
      {fullName(m)}
    </button>
  );
  const linkList = (list) =>
    list.length ? list.map((m, i) => (
      <span key={m.id}>
        {i > 0 && ', '}
        {link(m)}
      </span>
    )) : null;

  async function remove() {
    setError('');
    try {
      await onDelete(member);
    } catch (err) {
      setError(err.message);
      setConfirming(false);
    }
  }

  return (
    <div className="details">
      <div className="details-top">
        <Avatar member={member} size="xl" />
        <div>
          <h3>{fullNameWithPatronymic(member)}</h3>
          <p className="muted">
            {member.gender === 'ayol' ? 'Ayol' : 'Erkak'}
            {age !== null && (member.death_date ? ` · ${age} yoshida vafot etgan` : ` · ${age} yosh`)}
          </p>
        </div>
      </div>

      <dl className="detail-list">
        <Row label="Tug'ilgan sana">{formatDate(member.birth_date)}</Row>
        <Row label="Vafot sanasi">{formatDate(member.death_date)}</Row>
        <Row label="Tug'ilgan joy">{member.birth_place}</Row>
        <Row label="Kasbi">{member.occupation}</Row>
        <Row label="Telefon">
          {member.phone && <a href={`tel:${member.phone.replace(/[^\d+]/g, '')}`}>{member.phone}</a>}
        </Row>
        <Row label="Otasi">{father && link(father)}</Row>
        <Row label="Onasi">{mother && link(mother)}</Row>
        <Row label="Turmush o'rtog'i">{spouse && link(spouse)}</Row>
        <Row label="Farzandlari">{linkList(children)}</Row>
        <Row label="Aka-uka, opa-singillari">{linkList(siblings)}</Row>
      </dl>

      {member.bio && <p className="bio">{member.bio}</p>}

      <ErrorNote>{error}</ErrorNote>

      <div className="actions">
        {member.birth_date && (
          <button type="button" className="btn btn-gold" onClick={() => onCalendar(member)}>
            🎂 Kalendarga qo'shish
          </button>
        )}
        {canEdit && (
          <>
            <button type="button" className="btn" onClick={() => onEdit(member)}>
              Tahrirlash
            </button>
            <button type="button" className="btn" onClick={() => onAddChild(member)}>
              + Farzand
            </button>
            {!spouse && (
              <button type="button" className="btn" onClick={() => onAddSpouse(member)}>
                + Turmush o'rtog'i
              </button>
            )}
            {confirming ? (
              <span className="confirm">
                Rostdan o'chirilsinmi?
                <button type="button" className="btn btn-danger" onClick={remove}>
                  Ha, o'chirish
                </button>
                <button type="button" className="btn" onClick={() => setConfirming(false)}>
                  Bekor qilish
                </button>
              </span>
            ) : (
              <button type="button" className="btn btn-ghost-danger" onClick={() => setConfirming(true)}>
                O'chirish
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
