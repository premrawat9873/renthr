# new_rent_app

Next.js marketplace app with Redux state and Supabase Authentication.

## Development

```bash
npm install
npm run dev
```

Open http://localhost:3000.

## Supabase Auth Setup

This project uses Supabase Auth for email/password and OAuth sign-in.

1. Add these environment variables in `.env` or `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL="https://<your-project-ref>.supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="<your-anon-key>"
```

2. In Supabase Dashboard, configure Auth provider settings:

- Email/password provider enabled.
- OAuth providers (Google/Facebook) enabled if you want social login.

3. Add redirect URL in Supabase Auth settings:

- `http://localhost:3000`

After saving env vars, restart the dev server.

## Quality Checks

```bash
npm run lint
npm run build
```
