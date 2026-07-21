import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { isAuthorizedRequest, sendPushToAll } from '../_shared/push.ts';

serve(async (request) => {
  if (request.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  if (!isAuthorizedRequest(request)) {
    return new Response('Unauthorized', { status: 401 });
  }

  const payload = await request.json().catch(() => ({}));
  const result = await sendPushToAll({
    title: payload.title ?? 'VidMitka: потрібна відповідь',
    body: payload.body ?? 'Відкрийте розклад і відмітьте, чи зможете служити.',
    url: payload.url ?? '/',
    tag: payload.tag ?? 'vidmitka-reminder'
  });

  return Response.json(result);
});
