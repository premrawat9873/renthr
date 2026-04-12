type MaybeRecord = Record<string, unknown>;

function asRecord(value: unknown): MaybeRecord | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  return value as MaybeRecord;
}

function readString(record: MaybeRecord | null, key: string): string | null {
  if (!record) {
    return null;
  }

  const value = record[key];
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function readGoogleIdentitySubjectFromIdentities(identities: unknown): string | null {
  if (!Array.isArray(identities)) {
    return null;
  }

  for (const identity of identities) {
    const identityRecord = asRecord(identity);
    if (!identityRecord) {
      continue;
    }

    const provider = readString(identityRecord, 'provider');
    if (provider !== 'google') {
      continue;
    }

    const identityData = asRecord(identityRecord.identity_data);
    const subjectFromSub = readString(identityData, 'sub');
    if (subjectFromSub) {
      return subjectFromSub;
    }

    const subjectFromUserId = readString(identityData, 'user_id');
    if (subjectFromUserId) {
      return subjectFromUserId;
    }

    const providerId = readString(identityRecord, 'id');
    if (providerId) {
      return providerId;
    }
  }

  return null;
}

// Supports Supabase user payload variants for Google OAuth identities.
export function extractGoogleSubject(user: unknown): string | null {
  const userRecord = asRecord(user);
  if (!userRecord) {
    return null;
  }

  const appMetadata = asRecord(userRecord.app_metadata);
  const provider = readString(appMetadata, 'provider');

  if (provider === 'google') {
    const directSub = readString(userRecord, 'sub') ?? readString(userRecord, 'id');
    if (directSub) {
      return directSub;
    }
  }

  const identitiesSub = readGoogleIdentitySubjectFromIdentities(userRecord.identities);
  if (identitiesSub) {
    return identitiesSub;
  }

  const metadata = asRecord(userRecord.user_metadata);
  const metadataSub = readString(metadata, 'sub') ?? readString(metadata, 'provider_id');

  return metadataSub;
}
