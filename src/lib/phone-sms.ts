import 'server-only';

const INDIA_PHONE_PATTERN = /^\+91\d{10}$/;
const MSG91_ENDPOINT = 'https://control.msg91.com/api/v5/flow/';
const FAST2SMS_ENDPOINT = 'https://www.fast2sms.com/dev/bulkV2';
const DEFAULT_PHONE_VERIFICATION_UNAVAILABLE_MESSAGE =
  'Phone number verification is currently unavailable.';

type Msg91Config = {
  provider: 'MSG91';
  authKey: string;
  flowId: string;
  otpVariableName: string;
  expiryVariableName: string;
};

type Fast2SmsConfig = {
  provider: 'FAST2SMS';
  apiKey: string;
  endpoint: string;
  route: string;
  messageId: string;
  senderId: string;
  variablesTemplate: string;
};

type ProviderResponse = {
  type?: unknown;
  status?: unknown;
  return?: unknown;
  message?: unknown;
  request_id?: unknown;
};

type RecordLike = Record<string, unknown>;

export class PhoneSmsError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

function isRecord(value: unknown): value is RecordLike {
  return typeof value === 'object' && value !== null;
}

function toTrimmedString(value: unknown) {
  if (typeof value !== 'string') {
    return '';
  }

  return value.trim();
}

function parseBooleanFlag(value: unknown, defaultValue: boolean) {
  const normalized = toTrimmedString(value).toLowerCase();
  if (!normalized) {
    return defaultValue;
  }

  if (['1', 'true', 'yes', 'on', 'enabled'].includes(normalized)) {
    return true;
  }

  if (['0', 'false', 'no', 'off', 'disabled'].includes(normalized)) {
    return false;
  }

  return defaultValue;
}

function formatProviderMessageValue(value: unknown) {
  if (typeof value === 'string') {
    return value.trim();
  }

  if (Array.isArray(value)) {
    const normalized = value
      .map((item) => (typeof item === 'string' ? item.trim() : ''))
      .filter((item) => item.length > 0);

    return normalized.join(', ');
  }

  return '';
}

function getProviderConfig(): Msg91Config | Fast2SmsConfig | null {
  const provider = toTrimmedString(process.env.PHONE_SMS_PROVIDER).toUpperCase();
  if (!provider) {
    return null;
  }

  if (provider === 'MSG91') {
    const authKey = toTrimmedString(process.env.MSG91_AUTH_KEY);
    const flowId = toTrimmedString(process.env.MSG91_FLOW_ID);
    const otpVariableName =
      toTrimmedString(process.env.MSG91_OTP_VAR_NAME) ||
      'OTP';
    const expiryVariableName =
      toTrimmedString(process.env.MSG91_EXPIRY_VAR_NAME) ||
      'EXPIRY_MINUTES';

    if (!authKey || !flowId) {
      throw new PhoneSmsError(
        500,
        'MSG91 is enabled but missing configuration. Set MSG91_AUTH_KEY and MSG91_FLOW_ID.'
      );
    }

    return {
      provider: 'MSG91',
      authKey,
      flowId,
      otpVariableName,
      expiryVariableName,
    };
  }

  if (provider === 'FAST2SMS') {
    const apiKey =
      toTrimmedString(process.env.FAST2SMS_API_KEY) ||
      toTrimmedString(process.env.FAST2SMS_AUTHORIZATION);
    const endpoint =
      toTrimmedString(process.env.FAST2SMS_ENDPOINT) ||
      FAST2SMS_ENDPOINT;
    const route = toTrimmedString(process.env.FAST2SMS_ROUTE) || 'otp';
    const messageId = toTrimmedString(process.env.FAST2SMS_MESSAGE_ID);
    const senderId = toTrimmedString(process.env.FAST2SMS_SENDER_ID);
    const variablesTemplate =
      toTrimmedString(process.env.FAST2SMS_VARIABLES_TEMPLATE) ||
      '{OTP}';

    if (!apiKey) {
      throw new PhoneSmsError(
        500,
        'FAST2SMS is enabled but missing FAST2SMS_API_KEY (or FAST2SMS_AUTHORIZATION).'
      );
    }

    return {
      provider: 'FAST2SMS',
      apiKey,
      endpoint,
      route,
      messageId,
      senderId,
      variablesTemplate,
    };
  }

  throw new PhoneSmsError(
    500,
    'Unsupported PHONE_SMS_PROVIDER. Supported providers: MSG91, FAST2SMS.'
  );
}

function toMsg91Mobile(phoneE164: string) {
  if (!INDIA_PHONE_PATTERN.test(phoneE164)) {
    throw new PhoneSmsError(400, 'Phone OTP SMS is restricted to valid Indian +91 numbers.');
  }

  return phoneE164.replace('+', '');
}

function toFast2SmsMobile(phoneE164: string) {
  if (!INDIA_PHONE_PATTERN.test(phoneE164)) {
    throw new PhoneSmsError(400, 'Phone OTP SMS is restricted to valid Indian +91 numbers.');
  }

  return phoneE164.slice(3);
}

function formatFast2SmsVariables(
  template: string,
  otpCode: string,
  expiryMinutes: number
) {
  return template
    .split('{OTP}')
    .join(otpCode)
    .split('{EXPIRY_MINUTES}')
    .join(String(expiryMinutes));
}

async function parseProviderResponse(response: Response) {
  const rawText = await response.text();
  let json: ProviderResponse | null = null;

  if (rawText) {
    try {
      const parsed = JSON.parse(rawText);
      json = isRecord(parsed) ? (parsed as ProviderResponse) : null;
    } catch {
      json = null;
    }
  }

  const providerMessage =
    formatProviderMessageValue(json?.message) ||
    toTrimmedString(rawText) ||
    'No provider response body.';

  return {
    json,
    providerMessage,
  };
}

async function sendViaMsg91(
  config: Msg91Config,
  phoneE164: string,
  otpCode: string,
  expiryMinutes: number
) {
  const recipient: Record<string, string> = {
    mobiles: toMsg91Mobile(phoneE164),
    [config.otpVariableName]: otpCode,
    [config.expiryVariableName]: String(expiryMinutes),
  };

  const response = await fetch(MSG91_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      authkey: config.authKey,
    },
    body: JSON.stringify({
      template_id: config.flowId,
      short_url: '0',
      recipients: [recipient],
    }),
    cache: 'no-store',
  });

  const { json, providerMessage } = await parseProviderResponse(response);

  if (!response.ok) {
    throw new PhoneSmsError(
      502,
      `MSG91 request failed (${response.status}). ${providerMessage}`
    );
  }

  const responseType = toTrimmedString(json?.type).toLowerCase();
  if (responseType && responseType !== 'success') {
    throw new PhoneSmsError(502, `MSG91 rejected OTP request. ${providerMessage}`);
  }
}

async function sendViaFast2Sms(
  config: Fast2SmsConfig,
  phoneE164: string,
  otpCode: string,
  expiryMinutes: number
) {
  const requestBody = new URLSearchParams();

  requestBody.set('route', config.route);
  requestBody.set('numbers', toFast2SmsMobile(phoneE164));
  requestBody.set(
    'variables_values',
    formatFast2SmsVariables(config.variablesTemplate, otpCode, expiryMinutes)
  );

  if (config.messageId) {
    requestBody.set('message', config.messageId);
  }

  if (config.senderId) {
    requestBody.set('sender_id', config.senderId);
  }

  const response = await fetch(config.endpoint, {
    method: 'POST',
    headers: {
      authorization: config.apiKey,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: requestBody.toString(),
    cache: 'no-store',
  });

  const { json, providerMessage } = await parseProviderResponse(response);

  if (!response.ok) {
    throw new PhoneSmsError(
      502,
      `Fast2SMS request failed (${response.status}). ${providerMessage}`
    );
  }

  const returnValue = json?.return;
  const normalizedReturn =
    typeof returnValue === 'boolean'
      ? returnValue
      : toTrimmedString(returnValue).toLowerCase() === 'true';

  if (!normalizedReturn) {
    throw new PhoneSmsError(502, `Fast2SMS rejected OTP request. ${providerMessage}`);
  }
}

export function isPhoneSmsConfigured() {
  return Boolean(toTrimmedString(process.env.PHONE_SMS_PROVIDER));
}

export function isPhoneVerificationEnabled() {
  return parseBooleanFlag(process.env.PHONE_VERIFICATION_ENABLED, false);
}

export function getPhoneVerificationUnavailableMessage() {
  return (
    toTrimmedString(process.env.PHONE_VERIFICATION_UNAVAILABLE_MESSAGE) ||
    DEFAULT_PHONE_VERIFICATION_UNAVAILABLE_MESSAGE
  );
}

export async function sendPhoneVerificationOtpSms(input: {
  phoneE164: string;
  otpCode: string;
  expiryMinutes: number;
}) {
  const config = getProviderConfig();
  if (!config) {
    throw new PhoneSmsError(
      503,
      'Phone OTP SMS provider is not configured. Set PHONE_SMS_PROVIDER to MSG91 or FAST2SMS with provider credentials.'
    );
  }

  if (config.provider === 'MSG91') {
    await sendViaMsg91(config, input.phoneE164, input.otpCode, input.expiryMinutes);
    return;
  }

  if (config.provider === 'FAST2SMS') {
    await sendViaFast2Sms(config, input.phoneE164, input.otpCode, input.expiryMinutes);
    return;
  }

  throw new PhoneSmsError(500, 'Phone OTP SMS provider is not supported.');
}