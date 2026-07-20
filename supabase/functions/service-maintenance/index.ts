import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { adminClient, sendPushToAll } from '../_shared/push.ts';

const dayMs = 24 * 60 * 60 * 1000;

const toDateTime = (service: { service_date: string; service_time: string }) =>
  new Date(`${service.service_date}T${service.service_time}`);

const toDateInput = (date: Date) => date.toISOString().slice(0, 10);

const addDays = (date: Date, days: number) => {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
};

serve(async () => {
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
            recurring_parent_id: parentId,
            reminder_at: new Date(now.getTime() + dayMs).toISOString()
          })
          .select('id')
          .single();

        if (!insertError && nextService) {
          created.push(nextService.id);
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

  const { data: reminders, error: reminderError } = await adminClient
    .from('services')
    .select('*')
    .not('reminder_at', 'is', null)
    .is('reminder_sent_at', null)
    .lte('reminder_at', now.toISOString());

  if (reminderError) {
    return Response.json({ error: reminderError.message }, { status: 500 });
  }

  let push = { sent: 0, failed: 0 };

  for (const service of reminders ?? []) {
    push = await sendPushToAll({
      title: 'Проголосуйте за служіння',
      body: `${service.title}: ${service.service_date} о ${service.service_time.slice(0, 5)}.`,
      url: '/',
      tag: `service-${service.id}`
    });

    await adminClient
      .from('services')
      .update({ reminder_sent_at: now.toISOString() })
      .eq('id', service.id);
  }

  return Response.json({
    created,
    deleted,
    reminders: reminders?.length ?? 0,
    push
  });
});
