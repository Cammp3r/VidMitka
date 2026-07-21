import { AdminServiceCard } from './AdminServiceCard';

export function AdminServiceList({
  groups,
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
    <div className="mini-list">
      {groups.map((group) => (
        <div key={group.key} className="week-group">
          <h3 className="week-group-title">{group.label}</h3>
          {group.services.map((service) => (
            <AdminServiceCard
              key={service.id}
              service={service}
              responses={responses}
              profiles={profiles}
              responseOptions={responseOptions}
              onEdit={onEdit}
              onDelete={onDelete}
              onAssignUser={onAssignUser}
              onAdminResponseChange={onAdminResponseChange}
              onAddAdminResponse={onAddAdminResponse}
            />
          ))}
        </div>
      ))}
    </div>
  );
}
