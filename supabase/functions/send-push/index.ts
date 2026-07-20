import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { sendPushToAll } from '../_shared/push.ts';

serve(async (request) => {
  if (request.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const payload = await request.json().catch(() => ({}));
  const result = await sendPushToAll({
    title: payload.title ?? 'VidMitka',
    body: payload.body ?? 'Будь ласка, проголосуйте за служіння.',
    url: payload.url ?? '/',
    tag: payload.tag ?? 'vidmitka-reminder'
  });

  return Response.json(result);
});
