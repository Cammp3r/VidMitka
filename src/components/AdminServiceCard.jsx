import { formatServiceDate } from '../lib/dateUtils';
import { getServiceAssignments } from '../lib/serviceUtils';
import { RoleResponseEditor } from './RoleResponseEditor';

export function AdminServiceCard({
  service,
  responses,
  profiles,
  responseOptions,
  onEdit,
  onDelete,
  onAssignUser,
  onAdminResponseChange,
  onAddAdminResponse
}) {
  return (
    <article className="mini-card">
      <div className="mini-card-content">
        <div>
          <strong>{service.title}</strong>
          <p>{formatServiceDate(service.date)} · {service.time}</p>
          <p>{service.roles.length} ролей · {service.isRecurring ? 'регулярне' : 'разове'}</p>
        </div>
        <div className="admin-actions">
          <button type="button" className="secondary-button" onClick={() => onEdit(service)}>
            Редагувати
          </button>
          <button type="button" className="danger-button" onClick={() => onDelete(service.id)}>
            Видалити
          </button>
        </div>
        <details className="service-details">
          <summary>Голоси та відповіді</summary>
          <div className="response-editor">
            {service.roles.map((role) => (
              <RoleResponseEditor
                key={role}
                role={role}
                roleResponses={(responses[service.id] ?? {})[role] ?? {}}
                responseOptions={responseOptions}
                profiles={profiles}
                assignedUserId={getServiceAssignments(service)[role]?.userId ?? ''}
                onAssignUser={(profileId) => onAssignUser(service, role, profileId)}
                onAdminResponseChange={(name, value, targetUserId) =>
                  onAdminResponseChange(service.id, role, name, value, targetUserId)}
                onAddAdminResponse={(name, value) => onAddAdminResponse(service.id, role, name, value)}
              />
            ))}
          </div>
        </details>
      </div>
    </article>
  );
}
