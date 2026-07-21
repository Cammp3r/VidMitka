import { useState } from 'react';
import { getServiceAssignments } from '../lib/serviceUtils';
import { getGroupedResponses, getResponseCounts, getResponseValue } from '../lib/responseUtils';

export function RoleCard({ role, service, roleResponses, responseOptions, canVote, userId, voterKey, onVote }) {
  const [showNames, setShowNames] = useState(false);

  const currentVote = getResponseValue(roleResponses[voterKey]);
  const counts = getResponseCounts(roleResponses, responseOptions);
  const hasVotes = Object.keys(roleResponses).length > 0;
  const assignedUser = getServiceAssignments(service)[role];

  return (
    <article className="role-card">
      <div className="role-title-row">
        <h3>{role}</h3>
        {assignedUser?.userId === userId ? (
          <span className="vote-chip">Призначено вам</span>
        ) : currentVote ? (
          <span className="vote-chip">{currentVote}</span>
        ) : null}
      </div>
      {assignedUser ? <p className="field-hint">Призначено: {assignedUser.displayName}</p> : null}
      <div className="vote-row">
        {counts.map(({ option, count }) => (
          <button
            key={option}
            className={currentVote === option ? 'vote-button active' : 'vote-button'}
            disabled={!canVote}
            onClick={() => onVote(role, option)}
          >
            <span>{option}</span>
            <strong>{count}</strong>
          </button>
        ))}
      </div>
      <button
        type="button"
        className="secondary-button"
        disabled={!hasVotes}
        onClick={() => setShowNames((current) => !current)}
      >
        {showNames ? 'Сховати імена' : 'Показати імена'}
      </button>
      {showNames ? (
        <div className="results-list">
          {getGroupedResponses(roleResponses, responseOptions).map(({ option, names }) => (
            <div key={option} className="result-group">
              <strong>{option}</strong>
              {names.length ? (
                <ul>
                  {names.map((name) => (
                    <li key={name}>{name}</li>
                  ))}
                </ul>
              ) : (
                <p>Немає відповідей</p>
              )}
            </div>
          ))}
        </div>
      ) : null}
    </article>
  );
}
