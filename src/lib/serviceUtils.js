import { monthAheadMs, serviceRolesFallback } from './constants';
import { addDays, formatDateInput, getServiceStart, getTodayInputDate, sortServices } from './dateUtils';

export const createEmptyForm = () => ({
  id: '',
  date: getTodayInputDate(),
  time: '18:30',
  title: '',
  note: '',
  rolesText: serviceRolesFallback.join('\n'),
  isRecurring: false
});

export const formFromService = (service) => ({
  id: service.id,
  date: service.date,
  time: service.time,
  title: service.title,
  note: service.note,
  rolesText: service.roles.join('\n'),
  isRecurring: service.isRecurring,
  recurringParentId: service.recurringParentId
});

export const normalizeLines = (text, fallback) => {
  const lines = text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  return lines.length ? lines : fallback;
};

// Builds the service object the rest of the app works with (camelCase, normalized)
// from the raw admin form fields.
export const buildServiceFromForm = (form) => ({
  id: form.id || crypto.randomUUID(),
  date: form.date,
  time: form.time,
  title: form.title.trim(),
  note: form.note.trim() || 'Без опису',
  roles: normalizeLines(form.rolesText, serviceRolesFallback),
  isRecurring: form.isRecurring,
  recurringParentId: form.recurringParentId || form.id || crypto.randomUUID()
});

export const toTimeInput = (time) => time.slice(0, 5);

export const fromServiceRow = (row) => ({
  id: row.id,
  date: row.service_date,
  time: toTimeInput(row.service_time),
  title: row.title,
  note: row.note,
  roles: row.roles ?? [],
  isRecurring: row.is_recurring,
  recurringParentId: row.recurring_parent_id,
  assignments: {}
});

export const toServicePayload = (service) => ({
  ...(service.id ? { id: service.id } : {}),
  service_date: service.date,
  service_time: service.time,
  title: service.title,
  note: service.note,
  roles: service.roles,
  is_recurring: service.isRecurring,
  recurring_parent_id: service.recurringParentId
});

export const buildAssignmentMap = (rows) => {
  const map = {};

  rows.forEach((row) => {
    map[row.service_id] ??= {};
    map[row.service_id][row.role] = {
      id: row.id,
      userId: row.user_id,
      displayName: row.display_name,
      reminderSentAt: row.reminder_sent_at
    };
  });

  return map;
};

export const getServiceAssignments = (service) => service.assignments ?? {};

// --- Local demo mode (no Supabase configured) ---
// Mirrors what the `service-maintenance` edge function does server-side: roll expired
// occurrences forward by a week, then keep each recurring series topped up a month ahead.

const createNextRecurringService = (service, now) => {
  let nextStart = addDays(getServiceStart(service), 7);

  while (nextStart <= now) {
    nextStart = addDays(nextStart, 7);
  }

  const parentId = service.recurringParentId || service.id;
  const date = formatDateInput(nextStart);

  return {
    ...service,
    id: `${parentId}-${date}-${service.time}`,
    date,
    recurringParentId: parentId
  };
};

const ensureRecurringCoverage = (services, now) => {
  const horizon = new Date(now.getTime() + monthAheadMs);
  const seriesByParentId = new Map();

  services.forEach((service) => {
    if (!service.isRecurring) return;
    const parentId = service.recurringParentId || service.id;
    seriesByParentId.set(parentId, [...(seriesByParentId.get(parentId) ?? []), service]);
  });

  const additions = [];

  seriesByParentId.forEach((occurrences, parentId) => {
    const knownDates = new Set(occurrences.map((item) => item.date));
    let template = occurrences.reduce((latest, item) =>
      getServiceStart(item) > getServiceStart(latest) ? item : latest
    );
    let nextStart = addDays(getServiceStart(template), 7);

    while (nextStart <= horizon) {
      const nextDate = formatDateInput(nextStart);

      if (!knownDates.has(nextDate)) {
        const nextService = {
          ...template,
          id: `${parentId}-${nextDate}-${template.time}`,
          date: nextDate,
          recurringParentId: parentId
        };
        additions.push(nextService);
        knownDates.add(nextDate);
        template = nextService;
      }

      nextStart = addDays(nextStart, 7);
    }
  });

  return additions;
};

export const cleanupServices = (items, currentResponses, now = new Date()) => {
  const rolledForward = [];
  const nextResponses = {};
  const usedIds = new Set();

  items.forEach((service) => {
    if (getServiceStart(service) <= now) {
      if (service.isRecurring) {
        const nextService = createNextRecurringService(service, now);

        if (!usedIds.has(nextService.id)) {
          rolledForward.push(nextService);
          usedIds.add(nextService.id);
        }
      }

      return;
    }

    rolledForward.push(service);
    usedIds.add(service.id);
    if (currentResponses[service.id]) {
      nextResponses[service.id] = currentResponses[service.id];
    }
  });

  const additions = ensureRecurringCoverage(rolledForward, now).filter((service) => !usedIds.has(service.id));

  return {
    services: sortServices([...rolledForward, ...additions]),
    responses: nextResponses
  };
};
