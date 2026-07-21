import { formatServiceDate } from '../lib/dateUtils';

export function WeekAccordionList({ groups, selectedServiceId, onSelect }) {
  return (
    <section className="week-groups">
      {groups.map((group, index) => (
        <details key={group.key} className="week-accordion" open={index === 0}>
          <summary className="week-group-title">
            <span>{group.label}</span>
            <span className="week-group-meta">
              <span className="week-group-count">{group.services.length}</span>
              <span className="week-group-caret" aria-hidden="true">▾</span>
            </span>
          </summary>
          <div className="service-list">
            {group.services.map((service) => (
              <button
                key={service.id}
                className={`service-card ${service.id === selectedServiceId ? 'selected' : ''}`}
                onClick={() => onSelect(service.id)}
              >
                <span>{formatServiceDate(service.date)}</span>
                <strong>{service.time}</strong>
                <p>{service.title}</p>
                {service.isRecurring ? <small>Регулярне</small> : null}
              </button>
            ))}
          </div>
        </details>
      ))}
    </section>
  );
}
