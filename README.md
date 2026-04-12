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
MESSAGE_ENCRYPTION_SECRET="<long-random-secret>"
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

## Google Cross-Account Protection (CAP)

This project now includes a CAP receiver endpoint at `/api/auth/risc`.

1. Add Google OAuth audience values in your environment:

```env
GOOGLE_CLIENT_ID="<primary-google-oauth-client-id>"
# Optional: comma-separated list if you have multiple Google client IDs
GOOGLE_CLIENT_IDS="<web-client-id>,<android-client-id>,<ios-client-id>"
```

2. In Google Cloud Console (same project used for Sign in with Google):

- Enable the RISC API.
- Create a service account with role `roles/riscconfigs.admin`.
- Use the service account to call `https://risc.googleapis.com/v1beta/stream:update`.

3. Register delivery endpoint with push method:

```json
{
	"delivery": {
		"delivery_method": "https://schemas.openid.net/secevent/risc/delivery-method/push",
		"url": "https://renthour.in/api/auth/risc"
	},
	"events_requested": [
		"https://schemas.openid.net/secevent/risc/event-type/sessions-revoked",
		"https://schemas.openid.net/secevent/oauth/event-type/tokens-revoked",
		"https://schemas.openid.net/secevent/oauth/event-type/token-revoked",
		"https://schemas.openid.net/secevent/risc/event-type/account-disabled",
		"https://schemas.openid.net/secevent/risc/event-type/account-enabled",
		"https://schemas.openid.net/secevent/risc/event-type/account-credential-change-required",
		"https://schemas.openid.net/secevent/risc/event-type/verification"
	]
}
```

4. CAP behavior implemented in this app:

- Verifies token signature using Google JWKS from the RISC discovery document.
- Validates `iss` and `aud` (must match configured Google client IDs).
- De-duplicates events with `jti`.
- Maps CAP event subject (`sub`) to local users from OAuth sign-in mapping.
- Revokes app sessions for affected users on required events.
- Disables/re-enables Google sign-in for users when account state events indicate it.

## Quality Checks

```bash
npm run lint
npm run build
```
