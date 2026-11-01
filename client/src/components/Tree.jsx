import { useMemo } from 'react';
import { buildForest, lifeSpan, fullName } from '../utils.js';
import { Avatar, Empty } from './common.jsx';

function PersonCard({ member, onSelect }) {
  const dead = Boolean(member.death_date);
  return (
    <button
      type="button"
      className={`person ${member.gender === 'ayol' ? 'is-female' : 'is-male'} ${dead ? 'is-dead' : ''}`}
      onClick={() => onSelect(member.id)}
      title={fullName(member)}
    >
      <Avatar member={member} />
      <span className="person-text">
        <span className="person-name">{member.first_name}</span>
        <span className="person-last">{member.last_name || ' '}</span>
        <span className="person-years">{lifeSpan(member) || ' '}</span>
      </span>
    </button>
  );
}

function UnitNode({ unit, onSelect }) {
  return (
    <li>
      <div className="unit">
        <PersonCard member={unit.person} onSelect={onSelect} />
        {unit.partner && (
          <>
            <span className="knot" aria-label="turmush o'rtoq">
              ◆
            </span>
            <PersonCard member={unit.partner} onSelect={onSelect} />
          </>
        )}
      </div>
      {unit.children.length > 0 && (
        <ul>
          {unit.children.map((child) => (
            <UnitNode key={child.person.id} unit={child} onSelect={onSelect} />
          ))}
        </ul>
      )}
    </li>
  );
}

export default function Tree({ members, onSelect, canEdit, onAdd }) {
  const forest = useMemo(() => buildForest(members), [members]);

  if (members.length === 0) {
    return (
      <Empty title="Daraxt hali bo'sh">
        {canEdit ? (
          <>
            Birinchi oila a'zosini qo'shing — odatda eng keksa avlod vakilidan boshlanadi.
            <br />
            <button type="button" className="btn btn-primary" style={{ marginTop: 14 }} onClick={onAdd}>
              + Birinchi a'zoni qo'shish
            </button>
          </>
        ) : (
          "Admin oila a'zolarini qo'shgach, daraxt shu yerda paydo bo'ladi."
        )}
      </Empty>
    );
  }

  return (
    <div className="tree-scroll">
      <div className="tree">
        <ul className="tree-roots">
          {forest.map((unit) => (
            <UnitNode key={unit.person.id} unit={unit} onSelect={onSelect} />
          ))}
        </ul>
      </div>
    </div>
  );
}
