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

## India Phone OTP SMS Setup (MSG91 or Fast2SMS)

Phone OTP verification now supports India-only SMS delivery through MSG91 or Fast2SMS.

1. Choose one provider and complete DLT-approved OTP template setup.
2. Add provider-specific environment variables.

MSG91 variables:

```env
PHONE_SMS_PROVIDER="MSG91"
MSG91_AUTH_KEY="<msg91-auth-key>"
MSG91_FLOW_ID="<msg91-flow-id>"
# Optional if your flow uses different variable names:
MSG91_OTP_VAR_NAME="OTP"
MSG91_EXPIRY_VAR_NAME="EXPIRY_MINUTES"
```

Fast2SMS variables:

```env
PHONE_SMS_PROVIDER="FAST2SMS"
FAST2SMS_API_KEY="<fast2sms-api-key>"
# Optional overrides
FAST2SMS_ENDPOINT="https://www.fast2sms.com/dev/bulkV2"
FAST2SMS_ROUTE="otp"
FAST2SMS_MESSAGE_ID="<dlt-message-id-if-required>"
FAST2SMS_SENDER_ID="<sender-id-if-required>"
FAST2SMS_VARIABLES_TEMPLATE="{OTP}"
```

Behavior notes:

- Verification gate:
	- Set `PHONE_VERIFICATION_ENABLED="true"` to allow phone OTP verification.
	- If not set (or set to false), the API returns `Phone number verification is currently unavailable.`
- Optional custom unavailable message:
	- `PHONE_VERIFICATION_UNAVAILABLE_MESSAGE="..."`
- If SMS provider is configured, OTP is sent to +91 phone numbers only.
- If SMS provider is not configured:
	- Development or PHONE_OTP_DEBUG=true: API returns otpPreview for local testing.
	- Production: API returns a configuration error and does not keep a pending OTP.

Estimated monthly cost formula:

monthly_cost = otp_messages_per_month x per_sms_rate x (1 + tax)

For India, typical transactional OTP rates are often around INR 0.12 to INR 0.35 per SMS depending on route, DLT template category, and provider plan.

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
