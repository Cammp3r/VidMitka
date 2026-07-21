import { formatServiceDate } from '../lib/dateUtils';
import { RoleCard } from './RoleCard';

export function ServiceDetailPanel({ service, responses, responseOptions, canVote, userId, voterKey, onVote }) {
  if (!service) {
    return (
      <section className="panel">
        <h2>Розклад порожній</h2>
        <p className="muted">Нове служіння з'явиться тут, коли його додадуть у розклад.</p>
      </section>
    );
  }

  const serviceResponses = responses[service.id] ?? {};

  return (
    <section className="panel">
      <div className="panel-head">
        <div>
          <span className="eyebrow">{formatServiceDate(service.date)}</span>
          <h2>{service.title}</h2>
        </div>
        <div className="time-pill">{service.time}</div>
      </div>
      <p className="muted">{service.note}</p>

      <div className="roles-grid">
        {service.roles.map((role) => (
          <RoleCard
            key={role}
            role={role}
            service={service}
            roleResponses={serviceResponses[role] ?? {}}
            responseOptions={responseOptions}
            canVote={canVote}
            userId={userId}
            voterKey={voterKey}
            onVote={onVote}
          />
        ))}
      </div>
    </section>
  );
}
