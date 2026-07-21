import { useState } from 'react';
import { getGroupedResponses, getResponseCounts, getResponseName, getResponseValue } from '../lib/responseUtils';

export function RoleResponseEditor({
  role,
  roleResponses,
  responseOptions,
  profiles,
  assignedUserId,
  onAssignUser,
  onAdminResponseChange,
  onAddAdminResponse
}) {
  const [showVotes, setShowVotes] = useState(false);
  const [draft, setDraft] = useState({ name: '', value: responseOptions[0] ?? '' });

  const handleAddResponse = () => {
    const name = draft.name.trim();
    if (!name || !draft.value) return;

    onAddAdminResponse(name, draft.value);
    setDraft({ name: '', value: responseOptions[0] ?? '' });
  };

  return (
    <div className="admin-role-responses">
      <strong>{role}</strong>
      <label className="assignment-select-row">
        Призначити акаунт
        <select
          className="assignment-select"
          value={assignedUserId}
          onChange={(event) => onAssignUser(event.target.value)}
        >
          <option value="">Ніхто не призначений</option>
          {profiles.map((profile) => (
            <option key={profile.user_id} value={profile.user_id}>
              {profile.display_name}
            </option>
          ))}
        </select>
      </label>
      <div className="count-row">
        {getResponseCounts(roleResponses, responseOptions).map(({ option, count }) => (
          <span key={option}>{option}: {count}</span>
        ))}
      </div>
      <button type="button" className="secondary-button" onClick={() => setShowVotes((current) => !current)}>
        {showVotes ? 'Сховати список' : 'Відкрити список голосів'}
      </button>
      {showVotes ? (
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
      {Object.entries(roleResponses).map(([key, entry]) => (
        <label key={key}>
          {getResponseName(key, entry)}
          <select
            value={getResponseValue(entry)}
            onChange={(event) => onAdminResponseChange(getResponseName(key, entry), event.target.value, key)}
          >
            <option value="">Видалити відповідь</option>
            {responseOptions.map((option) => (
              <option key={option} value={option}>{option}</option>
            ))}
          </select>
        </label>
      ))}
      <div className="add-response-row">
        <input
          type="text"
          placeholder="Ім'я"
          value={draft.name}
          onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))}
        />
        <select
          value={draft.value}
          onChange={(event) => setDraft((current) => ({ ...current, value: event.target.value }))}
        >
          {responseOptions.map((option) => (
            <option key={option} value={option}>{option}</option>
          ))}
        </select>
        <button type="button" className="secondary-button" onClick={handleAddResponse}>
          Додати
        </button>
      </div>
    </div>
  );
}
