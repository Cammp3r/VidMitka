# Supabase deploy guide

## 1. Create Supabase project

1. Create a Supabase project.
2. In Authentication -> Providers, enable Anonymous sign-ins.
3. Open SQL Editor and run `supabase/schema.sql`.

## 2. Add frontend environment

Create `.env` from `.env.example`:

```bash
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-or-publishable-key
VITE_VAPID_PUBLIC_KEY=your-vapid-public-key
```

Use the anon/publishable key from Supabase Settings -> API.

## 3. Generate VAPID keys for push

```bash
npm run vapid
```

Put the public key into `.env` as `VITE_VAPID_PUBLIC_KEY`.

Save these secrets for Edge Functions:

```bash
supabase secrets set VAPID_PUBLIC_KEY="public-key"
supabase secrets set VAPID_PRIVATE_KEY="private-key"
supabase secrets set VAPID_SUBJECT="mailto:your-email@example.com"
```

Supabase provides `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` to Edge Functions automatically in most projects. If your project uses only new secret-key names, add `SUPABASE_SERVICE_ROLE_KEY` manually from Settings -> API.

## 4. Deploy Edge Functions

Install and login to Supabase CLI, then link the project:

```bash
supabase login
supabase link --project-ref your-project-ref
supabase functions deploy send-push
supabase functions deploy service-maintenance
```

## 5. Create the schedule job

In Supabase Dashboard -> Integrations -> Cron, create a job that calls:

```text
https://your-project-ref.supabase.co/functions/v1/service-maintenance
```

Recommended schedule:

```text
* * * * *
```

This checks every minute:

- ended one-time services are removed;
- ended recurring services are removed and the next weekly service is created;
- recurring next services get a push reminder after 24 hours;
- one-time services get a push reminder as soon as the cron sees them.

## 6. Deploy frontend

Build:

```bash
npm run build
```

Deploy `dist/` to any static hosting, for example Netlify, Vercel static hosting, Cloudflare Pages, or Supabase Storage hosting.

## Notes

- Realtime results work through Supabase Realtime on `services`, `response_options`, and `responses`.
- Stable user identity uses Supabase Anonymous Auth. If the user clears browser data or changes device, Supabase will create a new anonymous user.
- Current SQL policies allow any authenticated user to edit admin data. Before real use, add an `admins` table or role claim and restrict service/option editing to admins only.
