'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useSupabaseAuth } from '@/lib/supabase-auth';
import { useAppDispatch } from '@/store/hooks';
import { loginWithEmail } from '@/store/slices/authSlice';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';

type OAuthProvider = 'google' | 'facebook';
type AuthMode = 'login' | 'register';

// ── Icons ────────────────────────────────────────────────────────────────────

const EyeOpenIcon = () => (
  <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.477 0 8.268 2.943 9.542 7-1.274 4.057-5.065 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
  </svg>
);

const EyeClosedIcon = () => (
  <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.477 0-8.268-2.943-9.542-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.477 0 8.268 2.943 9.542 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
  </svg>
);

const GoogleIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24">
    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
  </svg>
);

const FacebookIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24">
    <path fill="#1877F2" d="M24 12.073C24 5.405 18.627 0 12 0S0 5.405 0 12.073C0 18.1 4.388 23.094 10.125 24v-8.437H7.078v-3.49h3.047V9.41c0-3.025 1.792-4.697 4.533-4.697 1.312 0 2.686.236 2.686.236v2.97h-1.513c-1.491 0-1.956.93-1.956 1.886v2.267h3.328l-.532 3.49h-2.796V24C19.612 23.094 24 18.1 24 12.073z" />
  </svg>
);

// ── Component ────────────────────────────────────────────────────────────────
export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const dispatch = useAppDispatch();
  const { status, supabase } = useSupabaseAuth();
  const [authMode, setAuthMode] = useState<AuthMode>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordLoginActive, setPasswordLoginActive] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [authMessage, setAuthMessage] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState<OAuthProvider | null>(null);
  const [otpRequested, setOtpRequested] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const nextParam = searchParams.get('next');
  const oauthErrorParam = searchParams.get('error');
  const postLoginRedirectPath =
    nextParam && nextParam.startsWith('/') && !nextParam.startsWith('//') ? nextParam : '/';

  const getAuthRedirectOrigin = () => {
    const currentOrigin = window.location.origin;
    const configuredSiteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim();

    if (configuredSiteUrl) {
      try {
        const configuredUrl = new URL(configuredSiteUrl);
        const configuredOrigin = configuredUrl.origin;
        const configuredHostIsLocal =
          configuredUrl.hostname === 'localhost' || configuredUrl.hostname === '127.0.0.1';
        const currentHostIsLocal =
          window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

        if (!configuredHostIsLocal && currentHostIsLocal) {
          return currentOrigin;
        }

        if (configuredUrl.hostname === window.location.hostname) {
          return configuredOrigin;
        }

        return currentOrigin;
      } catch {
        // Ignore invalid NEXT_PUBLIC_SITE_URL and fall back to current origin.
      }
    }

    return currentOrigin;
  };

  const getPostLoginRedirectUrl = () => `${getAuthRedirectOrigin()}${postLoginRedirectPath}`;

  const getOAuthCallbackUrl = () => {
    const callbackUrl = new URL('/auth/callback', getAuthRedirectOrigin());
    callbackUrl.searchParams.set('next', postLoginRedirectPath);
    return callbackUrl.toString();
  };

  const resetOtpState = () => {
    setOtpRequested(false);
    setOtpCode('');
  };

  useEffect(() => {
    if (status === 'authenticated') {
      router.replace(postLoginRedirectPath);
    }
  }, [status, router, postLoginRedirectPath]);

  useEffect(() => {
    if (!oauthErrorParam) {
      return;
    }

    const messageByErrorCode: Record<string, string> = {
      missing_oauth_code: 'Google sign-in could not be completed. Please try again.',
      missing_supabase_env: 'Auth is not configured correctly. Please contact support.',
      oauth_start_failed:
        'Google sign-in could not be started. If you use Brave, disable Shields for this site and try again.',
      oauth_exchange_failed:
        'Google sign-in session could not be created. If you use Brave, disable Shields for this site and try again.',
      oauth_user_missing: 'Google account details could not be loaded. Please try again.',
      oauth_callback_unexpected:
        'Google sign-in failed due to a temporary server issue. Please try again in a moment.',
    };

    setAuthError(
      messageByErrorCode[oauthErrorParam] ||
        'Sign-in could not be completed. Please try again.'
    );

    if (oauthErrorParam === 'oauth_exchange_failed' || oauthErrorParam === 'oauth_user_missing') {
      setAuthMessage('Resetting old session data. Please try Google sign-in again in a moment.');

      void supabase.auth.signOut({ scope: 'local' }).catch(() => {
        // Ignore local cleanup errors; server-side cleanup still runs below.
      });

      void fetch('/api/auth/logout', {
        method: 'POST',
        cache: 'no-store',
      }).catch(() => {
        // Ignore cleanup errors; manual retry still works.
      });
    }
  }, [oauthErrorParam, supabase]);

  const handleRegister = async () => {
    const emailValue = email.trim().toLowerCase();
    const passwordValue = password.trim();

    if (!emailValue || !passwordValue) {
      setAuthError('Email and password are required.');
      return;
    }

    if (authMode === 'register' && passwordValue.length < 8) {
      setAuthError('Password must be at least 8 characters.');
      return;
    }

    setAuthLoading(true);
    setAuthError(null);
    setAuthMessage(null);

    try {
      const { data, error } = await supabase.auth.signUp({
        email: emailValue,
        password: passwordValue,
        options: {
          data: {
            name: name.trim() || undefined,
          },
          emailRedirectTo: getPostLoginRedirectUrl(),
        },
      });

      if (error) {
        setAuthError(error.message);
        return;
      }

      const hasLinkedIdentity = (data.user?.identities?.length ?? 0) > 0;

      if (!data.session) {
        if (!hasLinkedIdentity) {
          setAuthError('An account with this email already exists. Please sign in instead.');
          return;
        }

        setAuthMessage('Account created. Please confirm your email from your inbox before signing in.');
        return;
      }

      dispatch(loginWithEmail({ email: emailValue }));
      router.replace(postLoginRedirectPath);
    } catch {
      setAuthError('Unable to create account right now. Please try again.');
    } finally {
      setAuthLoading(false);
    }
  };

  const handlePasswordLogin = async () => {
    const emailValue = email.trim().toLowerCase();
    const passwordValue = password.trim();

    resetOtpState();

    if (!emailValue) {
      setAuthError('Email is required.');
      return;
    }

    if (!passwordValue) {
      setPasswordLoginActive(true);
      setAuthError('Password is required for password login.');
      return;
    }

    setAuthLoading(true);
    setAuthError(null);
    setAuthMessage(null);

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: emailValue,
        password: passwordValue,
      });

      if (error) {
        if (error.message.toLowerCase().includes('email not confirmed')) {
          setAuthError('Please confirm your email first, then sign in with password.');
          return;
        }

        setAuthError(error.message || 'Invalid email or password.');
        return;
      }

      dispatch(loginWithEmail({ email: emailValue }));
      router.replace(postLoginRedirectPath);
    } catch {
      setAuthError('Unable to sign in right now. Please try again.');
    } finally {
      setAuthLoading(false);
    }
  };

  const requestOtpCode = async () => {
    const emailValue = email.trim().toLowerCase();

    if (!emailValue) {
      setAuthError('Email is required.');
      return;
    }

    setAuthLoading(true);
    setPasswordLoginActive(false);
    setAuthError(null);
    setAuthMessage(null);

    try {
      const response = await fetch('/api/auth/otp/request', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email: emailValue }),
      });

      const data = (await response.json()) as { error?: string; message?: string };

      if (!response.ok) {
        setAuthError(data.error || 'Unable to send OTP email right now. Please try again.');
        return;
      }

      setOtpRequested(true);
      setOtpCode('');
      setAuthMessage(
        data.message || 'We sent a 6-digit OTP to your email. Enter it below to continue.'
      );
    } catch {
      setAuthError('Unable to send OTP email right now. Please try again.');
    } finally {
      setAuthLoading(false);
    }
  };

  const verifyOtpCode = async () => {
    const emailValue = email.trim().toLowerCase();
    const otpValue = otpCode.trim();

    if (!emailValue) {
      setAuthError('Email is required.');
      return;
    }

    if (otpValue.length !== 6) {
      setAuthError('Enter the 6-digit OTP from your email.');
      return;
    }

    setAuthLoading(true);
    setAuthError(null);
    setAuthMessage(null);

    try {
      const response = await fetch('/api/auth/otp/verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: emailValue,
          otp: otpValue,
        }),
      });

      const data = (await response.json()) as { error?: string };

      if (!response.ok) {
        setAuthError(data.error || 'Invalid OTP. Please try again.');
        return;
      }

      dispatch(loginWithEmail({ email: emailValue }));
      router.replace(postLoginRedirectPath);
    } catch {
      setAuthError('Unable to verify OTP right now. Please try again.');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleOtpLogin = async () => {
    if (!otpRequested) {
      await requestOtpCode();
      return;
    }

    await verifyOtpCode();
  };

  const handleOAuthLogin = async (provider: OAuthProvider) => {
    setOauthLoading(provider);
    setAuthError(null);
    setAuthMessage(null);

    try {
      await supabase.auth.signOut({ scope: 'local' }).catch(() => {
        // Ignore local cleanup errors and continue with server-side cleanup.
      });

      // Start OAuth from a clean cookie state to avoid stale refresh-token loops.
      await fetch('/api/auth/logout', {
        method: 'POST',
        cache: 'no-store',
      }).catch(() => {
        // Ignore cleanup errors and still attempt OAuth.
      });

      if (provider === 'google') {
        const oauthStartUrl = `/api/auth/oauth/google/start?next=${encodeURIComponent(
          postLoginRedirectPath
        )}`;
        window.location.assign(oauthStartUrl);
        return;
      }

      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: getOAuthCallbackUrl(),
        },
      });

      if (error) {
        setAuthError(error.message);
      }
    } finally {
      setOauthLoading(null);
    }
  };

  const inputClass =
    'w-full px-4 py-3 border border-[#e0dfd8] rounded-xl bg-white text-[0.92rem] text-[#1a1a1a] font-dm outline-none transition-all duration-200 focus:border-[#2e8b57] focus:ring-2 focus:ring-[#2e8b57]/10';

  return (
    <>
      <style>{`
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(20px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .anim-1 { animation: fadeUp 0.55s ease both; }
        .anim-2 { animation: fadeUp 0.65s 0.15s ease both; }
        .font-sora { font-family: 'Space Grotesk', sans-serif; }
        .font-dm   { font-family: 'DM Sans', sans-serif; }
      `}</style>

      <div className="flex min-h-screen font-dm bg-[#f5f4ef]">
        {/* ── LEFT ── */}
        <div className="anim-1 flex flex-col justify-center items-center w-[52%] px-8 py-16 bg-[#f5f4ef]">
          {/* Inner container — fixed width, left-aligned text */}
          <div className="flex flex-col items-start w-full max-w-[420px]">
            {/* Logo */}
            <div className="flex items-center gap-1.5 mb-11">
              <span className="font-sora text-[1.05rem] font-medium text-[#1a1a1a] tracking-tight">
                rent
              </span>
              <span className="font-sora text-[1.05rem] font-bold text-[#1a1a1a] bg-[#f5bc00] px-2.5 py-[3px] rounded-md">
                hour
              </span>
            </div>

            <h1 className="font-sora text-[2rem] font-bold text-[#1a1a1a] tracking-tight mb-1.5">
              Log in
            </h1>
            <p className="text-[0.92rem] text-[#777] mb-7">
              Welcome back! Sign in to your account.
            </p>

            <div className="w-full max-w-[380px] space-y-1">
                {authMode === 'register' && (
                  <>
                    <label
                      htmlFor="name"
                      className="block text-[0.82rem] font-medium text-[#1a1a1a] mb-1.5"
                    >
                      Full Name
                    </label>
                    <input
                      id="name"
                      type="text"
                      placeholder="Your name"
                      value={name}
                      onChange={(e) => {
                        setName(e.target.value);
                        if (authError) setAuthError(null);
                        if (authMessage) setAuthMessage(null);
                      }}
                      autoComplete="name"
                      className={inputClass}
                    />
                  </>
                )}

                <label
                  htmlFor="email"
                  className="block text-[0.82rem] font-medium text-[#1a1a1a] mb-1.5 !mt-4"
                >
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    resetOtpState();
                    if (authError) setAuthError(null);
                    if (authMessage) setAuthMessage(null);
                  }}
                  autoComplete="email"
                  className={inputClass}
                />

                {authMode === 'login' && !passwordLoginActive && otpRequested && (
                  <>
                    <label
                      htmlFor="otp"
                      className="block text-[0.82rem] font-medium text-[#1a1a1a] !mt-4 mb-1.5"
                    >
                      Enter OTP
                    </label>
                    <div className="w-full rounded-2xl border border-[#dbe4da] bg-[linear-gradient(180deg,#ffffff_0%,#f5f8f5_100%)] px-4 py-4 shadow-[0_14px_30px_-24px_rgba(17,58,38,0.55)]">
                      <InputOTP
                        id="otp"
                        maxLength={6}
                        value={otpCode}
                        onChange={(value) => {
                          setOtpCode(value);
                          if (authError) setAuthError(null);
                        }}
                        containerClassName="justify-center gap-2"
                      >
                        <InputOTPGroup className="justify-center gap-2">
                          <InputOTPSlot index={0} className="h-12 w-10 sm:h-12 sm:w-11" />
                          <InputOTPSlot index={1} className="h-12 w-10 sm:h-12 sm:w-11" />
                          <InputOTPSlot index={2} className="h-12 w-10 sm:h-12 sm:w-11" />
                          <InputOTPSlot index={3} className="h-12 w-10 sm:h-12 sm:w-11" />
                          <InputOTPSlot index={4} className="h-12 w-10 sm:h-12 sm:w-11" />
                          <InputOTPSlot index={5} className="h-12 w-10 sm:h-12 sm:w-11" />
                        </InputOTPGroup>
                      </InputOTP>
                      <p className="mt-2 text-center text-[0.72rem] text-[#6b7770]">
                        Enter the 6-digit code from your email. Paste is supported.
                      </p>
                    </div>
                    <div className="flex justify-end !mt-2">
                      <button
                        type="button"
                        onClick={() => void requestOtpCode()}
                        disabled={authLoading || oauthLoading !== null}
                        className="text-[0.82rem] font-medium text-[#2e8b57] hover:text-[#1a6b3c] transition-colors disabled:opacity-60"
                      >
                        Resend OTP
                      </button>
                    </div>
                  </>
                )}

                {(authMode === 'register' || passwordLoginActive) && (
                  <>
                    <label
                      htmlFor="password"
                      className="block text-[0.82rem] font-medium text-[#1a1a1a] !mt-4 mb-1.5"
                    >
                      Password
                    </label>
                    <div className="relative">
                      <input
                        id="password"
                        type={showPassword ? 'text' : 'password'}
                        placeholder="••••••••"
                        value={password}
                        onChange={(e) => {
                          setPassword(e.target.value);
                          if (authError) setAuthError(null);
                          if (authMessage) setAuthMessage(null);
                        }}
                        autoComplete={authMode === 'register' ? 'new-password' : 'current-password'}
                        className={`${inputClass} pr-11`}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        aria-label="Toggle password visibility"
                        className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#777] hover:text-[#444] transition-colors"
                      >
                        {showPassword ? <EyeClosedIcon /> : <EyeOpenIcon />}
                      </button>
                    </div>
                  </>
                )}

                {authMode === 'login' && passwordLoginActive && (
                  <div className="flex justify-end !mt-2">
                    <a
                      href="#"
                      onClick={(event) => {
                        event.preventDefault();
                        setPasswordLoginActive(false);
                        setPassword('');
                        setAuthError(null);
                        setAuthMessage(null);
                      }}
                      className="text-[0.82rem] font-medium text-[#2e8b57] hover:text-[#1a6b3c] transition-colors"
                    >
                      Use OTP instead
                    </a>
                  </div>
                )}

                {authError && (
                  <p className="!mt-3 text-[0.82rem] font-medium text-[#b42318]">{authError}</p>
                )}
                {authMessage && (
                  <p className="!mt-3 text-[0.82rem] font-medium text-[#1f6f43]">{authMessage}</p>
                )}

                {authMode === 'register' ? (
                  <button
                    type="button"
                    onClick={() => void handleRegister()}
                    disabled={authLoading || oauthLoading !== null}
                    className="w-full !mt-5 py-3.5 bg-[#1a6b3c] hover:bg-[#2e8b57] text-white font-sora font-semibold text-[0.95rem] rounded-xl tracking-wide transition-all duration-200 hover:shadow-lg hover:shadow-green-900/20 hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-70 disabled:pointer-events-none"
                  >
                    {authLoading ? 'Please wait...' : 'Create Account'}
                  </button>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 !mt-5">
                    <button
                      type="button"
                      onClick={() => void handleOtpLogin()}
                      disabled={
                        authLoading ||
                        oauthLoading !== null ||
                        (otpRequested && otpCode.trim().length !== 6)
                      }
                      className="py-3.5 bg-[#1a6b3c] hover:bg-[#2e8b57] text-white font-sora font-semibold text-[0.9rem] rounded-xl tracking-wide transition-all duration-200 hover:shadow-lg hover:shadow-green-900/20 hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-70 disabled:pointer-events-none"
                    >
                      {authLoading ? 'Please wait...' : otpRequested ? 'Verify OTP' : 'Login with OTP'}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        resetOtpState();
                        setPasswordLoginActive(true);
                        void handlePasswordLogin();
                      }}
                      disabled={authLoading || oauthLoading !== null}
                      className="py-3.5 bg-[#145f37] hover:bg-[#1a6b3c] text-white font-sora font-semibold text-[0.9rem] rounded-xl tracking-wide transition-all duration-200 hover:shadow-lg hover:shadow-green-900/20 hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-70 disabled:pointer-events-none"
                    >
                      {authLoading ? 'Please wait...' : 'Login with Password'}
                    </button>
                  </div>
                )}
              </div>

            {/* Divider */}
            <div className="flex items-center gap-3 my-5 w-full max-w-[380px] text-[#777] text-[0.75rem] tracking-widest uppercase">
              <div className="flex-1 h-px bg-[#e0dfd8]" />
              or continue with
              <div className="flex-1 h-px bg-[#e0dfd8]" />
            </div>

            {/* Social Buttons */}
            <div className="flex gap-3 w-full max-w-[380px]">
              {[
                { label: 'Google', provider: 'google' as const, icon: <GoogleIcon /> },
                { label: 'Facebook', provider: 'facebook' as const, icon: <FacebookIcon /> },
              ].map(({ label, provider, icon }) => (
                <button
                  key={label}
                  onClick={() => void handleOAuthLogin(provider)}
                  disabled={oauthLoading !== null}
                  className="flex-1 flex items-center justify-center gap-2.5 py-2.5 border border-[#e0dfd8] hover:border-[#bbb] rounded-xl bg-white text-[0.88rem] font-medium text-[#1a1a1a] transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-60 disabled:pointer-events-none"
                >
                  {icon} {oauthLoading === provider ? 'Connecting...' : label}
                </button>
              ))}
            </div>

            {/* Register */}
            <p className="w-full max-w-[380px] text-center text-[0.85rem] text-[#777] mt-6">
              {authMode === 'login' ? 'Don\'t have an account?' : 'Already have an account?'}{' '}
              <button
                type="button"
                onClick={() => {
                  setAuthMode(authMode === 'login' ? 'register' : 'login');
                  setPassword('');
                  setPasswordLoginActive(false);
                  resetOtpState();
                  setAuthError(null);
                  setAuthMessage(null);
                }}
                className="text-[#2e8b57] hover:text-[#1a6b3c] font-semibold transition-colors"
              >
                {authMode === 'login' ? 'Create account' : 'Sign in'}
              </button>
            </p>

            <p className="w-full max-w-[380px] text-center text-[0.78rem] text-[#7b7b7b] mt-3 leading-relaxed">
              By continuing, you agree to our{' '}
              <Link href="/terms-of-use" className="font-medium text-[#2e8b57] hover:text-[#1a6b3c]">
                Terms of Use
              </Link>
              {' '}and{' '}
              <Link href="/privacy-policy" className="font-medium text-[#2e8b57] hover:text-[#1a6b3c]">
                Privacy Policy
              </Link>
              .
            </p>
          </div>
          {/* end inner container */}
        </div>

        {/* ── RIGHT ── */}
        <div
          className="flex-1 relative flex flex-col justify-center items-center px-12 py-16 overflow-hidden"
          style={{
            background: 'linear-gradient(145deg, #1e7a45 0%, #2e8b57 45%, #4caf78 100%)',
          }}
        >
          {/* Blobs */}
          <div className="absolute w-[420px] h-[420px] rounded-full bg-white opacity-[0.15] -top-28 -right-28 pointer-events-none" />
          <div className="absolute w-[300px] h-[300px] rounded-full bg-white opacity-10 -bottom-20 -left-16 pointer-events-none" />

          <div className="anim-2 relative z-10 text-center">
            <h2 className="font-sora text-[2.4rem] font-bold text-white leading-[1.2] tracking-tight mb-5">
              Rent anything,
              <br />
              from anyone nearby.
            </h2>
            <p className="text-[0.95rem] text-white/80 max-w-[320px] mx-auto leading-relaxed mb-12">
              Join thousands of people renting and selling items in their community.
            </p>

            <div className="flex gap-12 justify-center">
              {[
                { number: '10k+', label: 'Products' },
                { number: '5k+', label: 'Users' },
                { number: '50+', label: 'Cities' },
              ].map(({ number, label }) => (
                <div key={label} className="text-center">
                  <div className="font-sora text-[2rem] font-bold text-white tracking-tight">
                    {number}
                  </div>
                  <div className="text-[0.8rem] text-white/70 mt-0.5 tracking-wide">{label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
