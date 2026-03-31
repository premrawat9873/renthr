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

3. Redirect URLs to configure (keep both local and prod):

- Local dev: `http://localhost:3000` and `http://localhost:3000/auth/callback`
- Production Supabase Auth: `https://renthour.in/auth/callback` and set **Site URL** to `https://renthour.in`
- Production NextAuth (Google): `https://renthour.in/api/auth/callback/google`; set `NEXTAUTH_URL` and `NEXT_PUBLIC_SITE_URL` to `https://renthour.in`

After saving env vars, restart the dev server.

## Cloudflare R2 Image Upload Setup

Listing images are uploaded through `POST /api/images/upload` and stored in Cloudflare R2.

Add these environment variables:

```env
R2_PUBLIC_URL="https://<public-r2-domain>"
R2_ACCOUNT_ID="<cloudflare-account-id>"
S3_API="https://<cloudflare-account-id>.r2.cloudflarestorage.com"
R2_BUCKET_NAME="rent-hr-bucket"
R2_ACCESS_KEY_ID="<r2-access-key-id>"
R2_SECRET_ACCESS_KEY="<r2-secret-access-key>"
```

## Quality Checks

```bash
npm run lint
npm run build
```
