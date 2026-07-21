import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { adminClient, isAuthorizedRequest, sendPushToUsers } from '../_shared/push.ts';

const dayMs = 24 * 60 * 60 * 1000;
const monthAheadMs = 30 * dayMs;

const toDateTime = (service: { service_date: string; service_time: string }) =>
  new Date(`${service.service_date}T${service.service_time}`);

const toDateInput = (date: Date) => date.toISOString().slice(0, 10);

const addDays = (date: Date, days: number) => {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
};

serve(async (request) => {
  if (!isAuthorizedRequest(request)) {
    return new Response('Unauthorized', { status: 401 });
  }

  const now = new Date();

  const { data: services, error } = await adminClient
    .from('services')
    .select('*')
    .order('service_date')
    .order('service_time');

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  const expired = (services ?? []).filter((service) => toDateTime(service) <= now);
  const created: string[] = [];
  const deleted: string[] = [];

  for (const service of expired) {
    if (service.is_recurring) {
      let nextStart = addDays(toDateTime(service), 7);

      while (nextStart <= now) {
        nextStart = addDays(nextStart, 7);
      }

      const parentId = service.recurring_parent_id ?? service.id;
      const nextDate = toDateInput(nextStart);
      const { data: existing } = await adminClient
        .from('services')
        .select('id')
        .eq('recurring_parent_id', parentId)
        .eq('service_date', nextDate)
        .eq('service_time', service.service_time)
        .maybeSingle();

      if (!existing) {
        const { data: nextService, error: insertError } = await adminClient
          .from('services')
          .insert({
            service_date: nextDate,
            service_time: service.service_time,
            title: service.title,
            note: service.note,
            roles: service.roles,
            is_recurring: true,
            recurring_parent_id: parentId
          })
          .select('id')
          .single();

        if (!insertError && nextService) {
          created.push(nextService.id);

          const { data: assignments } = await adminClient
            .from('service_assignments')
            .select('role, user_id, display_name')
            .eq('service_id', service.id);

          if (assignments?.length) {
            await adminClient.from('service_assignments').insert(
              assignments.map((assignment) => ({
                service_id: nextService.id,
                role: assignment.role,
                user_id: assignment.user_id,
                display_name: assignment.display_name
              }))
            );
          }
        }
      }
    }

    const { error: deleteError } = await adminClient
      .from('services')
      .delete()
      .eq('id', service.id);

    if (!deleteError) {
      deleted.push(service.id);
    }
  }

  const { data: recurringServices, error: recurringError } = await adminClient
    .from('services')
    .select('*')
    .eq('is_recurring', true)
    .order('service_date')
    .order('service_time');

  if (recurringError) {
    return Response.json({ error: recurringError.message }, { status: 500 });
  }

  const seriesByParentId = new Map<string, any[]>();

  for (const service of recurringServices ?? []) {
    const parentId = service.recurring_parent_id ?? service.id;
    if (toDateTime(service) <= now) continue;

    if (!seriesByParentId.has(parentId)) {
      seriesByParentId.set(parentId, []);
    }
    seriesByParentId.get(parentId)!.push(service);
  }

  const horizon = new Date(now.getTime() + monthAheadMs);

  for (const [parentId, occurrences] of seriesByParentId) {
    let template = occurrences.reduce((latest, item) =>
      toDateTime(item) > toDateTime(latest) ? item : latest
    );
    let nextStart = addDays(toDateTime(template), 7);

    while (nextStart <= horizon) {
      const nextDate = toDateInput(nextStart);
      const { data: existing } = await adminClient
        .from('services')
        .select('id')
        .eq('recurring_parent_id', parentId)
        .eq('service_date', nextDate)
        .eq('service_time', template.service_time)
        .maybeSingle();

      if (!existing) {
        const { data: nextService, error: insertError } = await adminClient
          .from('services')
          .insert({
            service_date: nextDate,
            service_time: template.service_time,
            title: template.title,
            note: template.note,
            roles: template.roles,
            is_recurring: true,
            recurring_parent_id: parentId
          })
          .select('id')
          .single();

        if (!insertError && nextService) {
          created.push(nextService.id);

          const { data: assignments } = await adminClient
            .from('service_assignments')
            .select('role, user_id, display_name')
            .eq('service_id', template.id);

          if (assignments?.length) {
            await adminClient.from('service_assignments').insert(
              assignments.map((assignment) => ({
                service_id: nextService.id,
                role: assignment.role,
                user_id: assignment.user_id,
                display_name: assignment.display_name
              }))
            );
          }

          template = { ...template, id: nextService.id, service_date: nextDate };
        }
      } else {
        template = { ...template, id: existing.id, service_date: nextDate };
      }

      nextStart = addDays(nextStart, 7);
    }
  }

  const { data: assignments, error: assignmentError } = await adminClient
    .from('service_assignments')
    .select('id, role, user_id, service_id, services(title, service_date, service_time)')
    .is('reminder_sent_at', null);

  if (assignmentError) {
    return Response.json({ error: assignmentError.message }, { status: 500 });
  }

  const { data: appSettings, error: appSettingsError } = await adminClient
    .from('app_settings')
    .select('notification_offset_minutes')
    .eq('id', 1)
    .maybeSingle();

  if (appSettingsError) {
    return Response.json({ error: appSettingsError.message }, { status: 500 });
  }

  const offsetMinutes = appSettings?.notification_offset_minutes ?? 1440;

  let reminderCount = 0;
  let push = { sent: 0, failed: 0 };

  for (const assignment of assignments ?? []) {
    const service = assignment.services;
    if (!service) continue;

    const serviceStart = toDateTime(service);
    if (serviceStart <= now) continue;

    const reminderAt = new Date(serviceStart.getTime() - offsetMinutes * 60 * 1000);
    if (reminderAt > now) continue;

    const result = await sendPushToUsers([assignment.user_id], {
      title: 'VidMitka: нагадування про служіння',
      body: `${service.title} ${service.service_date} о ${service.service_time.slice(0, 5)}. Роль: ${assignment.role}.`,
      url: '/',
      tag: `assignment-reminder-${assignment.id}`
    });

    push = {
      sent: push.sent + result.sent,
      failed: push.failed + result.failed
    };
    reminderCount += 1;

    await adminClient
      .from('service_assignments')
      .update({ reminder_sent_at: now.toISOString() })
      .eq('id', assignment.id);
  }

  return Response.json({
    created,
    deleted,
    reminders: reminderCount,
    push
  });
});
