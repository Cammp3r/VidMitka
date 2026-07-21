import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { isAuthorizedRequest, sendPushToAll, sendPushToUsers } from '../_shared/push.ts';

serve(async (request) => {
  if (request.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  if (!isAuthorizedRequest(request)) {
    return new Response('Unauthorized', { status: 401 });
  }

  const payload = await request.json().catch(() => ({}));
  const notification = {
    title: payload.title ?? 'VidMitka',
    body: payload.body ?? 'Відкрийте розклад і перевірте служіння.',
    url: payload.url ?? '/',
    tag: payload.tag ?? 'vidmitka-reminder'
  };
  const userIds = Array.isArray(payload.userIds) ? payload.userIds.filter(Boolean) : [];
  const result = userIds.length
    ? await sendPushToUsers(userIds, notification)
    : await sendPushToAll(notification);

  return Response.json(result);
});
