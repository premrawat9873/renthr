/// <reference types="node" />

import { spawn } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

type CheckResult = {
  name: string;
  ok: boolean;
  details: string;
};

type SmokeOptions = {
  withDevProbes: boolean;
  requireDb: boolean;
  baseUrl: string;
};

const args = process.argv.slice(2);
const options: SmokeOptions = {
  withDevProbes: args.includes('--with-dev-probes'),
  requireDb: args.includes('--require-db'),
  baseUrl: getFlagValue('--base-url') ?? 'http://127.0.0.1:3100',
};

function getFlagValue(flag: string) {
  const index = args.findIndex((value: string) => value === flag);
  if (index === -1) {
    return null;
  }

  const next = args[index + 1];
  return next && !next.startsWith('--') ? next : null;
}

async function readText(filePath: string) {
  return readFile(filePath, 'utf8');
}

function assertPattern(
  checks: CheckResult[],
  filePath: string,
  source: string,
  pattern: RegExp,
  name: string,
  successDetails: string
) {
  const ok = pattern.test(source);
  checks.push({
    name,
    ok,
    details: ok
      ? successDetails
      : `Pattern not found in ${filePath}: ${pattern.source}`,
  });
}

async function runStaticFlowChecks(projectRoot: string) {
  const checks: CheckResult[] = [];
  const mobileRoot = path.resolve(projectRoot, '..', 'mobile app');

  const webSearchPath = path.join(
    projectRoot,
    'src',
    'components',
    'marketplace',
    'SearchPageClient.tsx'
  );
  const mobileSearchPath = path.join(mobileRoot, 'src', 'screens', 'SearchScreen.tsx');
  const chatLibPath = path.join(projectRoot, 'src', 'lib', 'chat.ts');
  const chatRoutePath = path.join(
    projectRoot,
    'app',
    'api',
    'chat',
    'conversations',
    'route.ts'
  );
  const listingsRoutePath = path.join(projectRoot, 'app', 'api', 'listings', 'route.ts');
  const webPostFlowPath = path.join(
    projectRoot,
    'src',
    'components',
    'marketplace',
    'PostListingFlowDialog.tsx'
  );
  const mobileCreateListingPath = path.join(
    mobileRoot,
    'src',
    'screens',
    'CreateListingScreen.tsx'
  );

  const [
    webSearchSource,
    mobileSearchSource,
    chatLibSource,
    chatRouteSource,
    listingsRouteSource,
    webPostFlowSource,
    mobileCreateListingSource,
  ] = await Promise.all([
    readText(webSearchPath),
    readText(mobileSearchPath),
    readText(chatLibPath),
    readText(chatRoutePath),
    readText(listingsRoutePath),
    readText(webPostFlowPath),
    readText(mobileCreateListingPath),
  ]);

  assertPattern(
    checks,
    webSearchPath,
    webSearchSource,
    /const \[hasSubmittedSearch,\s*setHasSubmittedSearch\]\s*=\s*useState\(/,
    'Web search has explicit submit state',
    'Search result rendering is gated by submit state.'
  );
  assertPattern(
    checks,
    webSearchPath,
    webSearchSource,
    /if \(!hasSubmittedSearch \|\| !committedQuery\.trim\(\)\)\s*{\s*return;/,
    'Web search blocks fetch before submit',
    'Data fetch effect returns early before explicit submit.'
  );
  assertPattern(
    checks,
    webSearchPath,
    webSearchSource,
    /const visibleProducts\s*=\s*useMemo\([\s\S]*\.filter\(\(product\)\s*=>\s*matchesSubcategories\(product,\s*selectedSubcategories\)\),/s,
    'Web search applies subcategory filtering',
    'Subcategory selection contributes to product visibility.'
  );

  assertPattern(
    checks,
    mobileSearchPath,
    mobileSearchSource,
    /const \[hasSubmittedSearch,\s*setHasSubmittedSearch\]\s*=\s*useState\(/,
    'Mobile search has explicit submit state',
    'Mobile search uses submit gate before showing results.'
  );
  assertPattern(
    checks,
    mobileSearchPath,
    mobileSearchSource,
    /if \(!normalizedQuery\)\s*{[\s\S]*setHasSubmittedSearch\(false\);/,
    'Mobile search clears state on empty submit',
    'Empty query clears submitted state and results.'
  );
  assertPattern(
    checks,
    mobileSearchPath,
    mobileSearchSource,
    /onSubmitEditing=\{handleSubmitSearch\}/,
    'Mobile search supports enter-submit',
    'Enter key submit remains wired to explicit search handler.'
  );
  assertPattern(
    checks,
    mobileSearchPath,
    mobileSearchSource,
    /function matchesSelectedSubcategories\(product:\s*Product,\s*selectedSubcategoryIds:\s*string\[]\)/,
    'Mobile search includes subcategory matcher',
    'Subcategory matching function exists in search flow.'
  );

  assertPattern(
    checks,
    chatLibPath,
    chatLibSource,
    /const includeEmpty = options\?\.includeEmpty === true;/,
    'Chat lib supports includeEmpty option',
    'Conversation listing supports optional empty-thread inclusion.'
  );
  assertPattern(
    checks,
    chatLibPath,
    chatLibSource,
    /\(includeEmpty[\s\S]*\?[\s\S]*\{\}[\s\S]*:[\s\S]*lastMessageAt:\s*\{[\s\S]*not:\s*null[\s\S]*\}/s,
    'Chat lib hides empty conversations by default',
    'Default query enforces lastMessageAt not null.'
  );
  assertPattern(
    checks,
    chatLibPath,
    chatLibSource,
    /listChatConversationsForUser\(userId,\s*\{[\s\S]*includeEmpty:\s*true,[\s\S]*\}\)/,
    'Chat lib keeps starter conversation retrievable',
    'Conversation-start flow requests includeEmpty true.'
  );

  assertPattern(
    checks,
    chatRoutePath,
    chatRouteSource,
    /searchParams\.get\('includeEmpty'\) === '1'[\s\S]*searchParams\.get\('includeEmpty'\) === 'true'/,
    'Chat conversations API parses includeEmpty query',
    'API route supports includeEmpty query flag.'
  );

  assertPattern(
    checks,
    listingsRoutePath,
    listingsRouteSource,
    /const saveAddress = parseBoolean\(body\.saveAddress, false\);/,
    'Listings API reads explicit saveAddress flag',
    'Create listing endpoint parses saveAddress input.'
  );
  assertPattern(
    checks,
    listingsRoutePath,
    listingsRouteSource,
    /if \(saveAddress\)\s*{[\s\S]*tx\.address\.create\([\s\S]*userId:\s*user\.id/s,
    'Listings API saves profile address only when requested',
    'Address book write is conditionally gated by saveAddress.'
  );

  assertPattern(
    checks,
    webPostFlowPath,
    webPostFlowSource,
    /saveAddress:\s*saveAddressForFuture\s*&&\s*!selectedSavedAddressId/,
    'Web posting flow sends saveAddress toggle',
    'Web posting payload forwards explicit saveAddress behavior.'
  );
  assertPattern(
    checks,
    mobileCreateListingPath,
    mobileCreateListingSource,
    /saveAddress:\s*saveAddressForFuture\s*&&\s*!selectedSavedAddressId/,
    'Mobile posting flow sends saveAddress toggle',
    'Mobile posting payload forwards explicit saveAddress behavior.'
  );

  return checks;
}

function formatCheckLine(result: CheckResult) {
  const status = result.ok ? 'PASS' : 'FAIL';
  return `${status} - ${result.name}: ${result.details}`;
}

function printCheckSummary(title: string, checks: CheckResult[]) {
  console.log(`\n${title}`);
  for (const check of checks) {
    console.log(formatCheckLine(check));
  }
}

function ensureUrl(baseUrl: string, endpointPath: string) {
  return `${baseUrl.replace(/\/$/, '')}${endpointPath}`;
}

async function fetchWithTimeout(url: string, timeoutMs: number) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, {
      signal: controller.signal,
      headers: {
        Accept: 'application/json,text/html;q=0.9,*/*;q=0.8',
      },
    });
  } finally {
    clearTimeout(timeout);
  }
}

async function waitForServer(baseUrl: string, timeoutMs: number) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetchWithTimeout(
        ensureUrl(baseUrl, '/api/listings?limit=1'),
        3000
      );

      if (response.status >= 200) {
        return true;
      }
    } catch {
      // Continue polling until timeout.
    }

    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  return false;
}

async function runEndpointProbes(
  baseUrl: string,
  requireDb: boolean
): Promise<CheckResult[]> {
  const checks: CheckResult[] = [];

  const listingsUrl = ensureUrl(baseUrl, '/api/listings?limit=1');
  const listingsResponse = await fetchWithTimeout(listingsUrl, 8000);
  const listingsStatus = listingsResponse.status;
  const listingsBody = await listingsResponse.text();

  const listingsReachable = listingsStatus === 200 || listingsStatus === 503;
  checks.push({
    name: 'Listings API probe reachable',
    ok: listingsReachable,
    details: `GET /api/listings?limit=1 returned status ${listingsStatus}`,
  });

  if (requireDb) {
    checks.push({
      name: 'Listings API requires live DB in strict mode',
      ok: listingsStatus === 200,
      details:
        listingsStatus === 200
          ? 'Listings endpoint responded with live data.'
          : `Strict DB mode expected 200 but received ${listingsStatus}. Body: ${truncate(listingsBody, 180)}`,
    });
  }

  const chatNoFlag = await fetchWithTimeout(
    ensureUrl(baseUrl, '/api/chat/conversations'),
    8000
  );
  const chatWithFlag = await fetchWithTimeout(
    ensureUrl(baseUrl, '/api/chat/conversations?includeEmpty=1'),
    8000
  );

  checks.push({
    name: 'Chat conversations probe without auth returns unauthorized',
    ok: chatNoFlag.status === 401,
    details: `GET /api/chat/conversations returned ${chatNoFlag.status}`,
  });

  checks.push({
    name: 'Chat includeEmpty probe stays reachable without auth',
    ok: chatWithFlag.status === 401,
    details: `GET /api/chat/conversations?includeEmpty=1 returned ${chatWithFlag.status}`,
  });

  const messagesPage = await fetchWithTimeout(
    ensureUrl(baseUrl, '/messages?conversation=1&draft=test'),
    8000
  );
  checks.push({
    name: 'Messages page renders with conversation and draft query params',
    ok: messagesPage.status === 200,
    details: `GET /messages?conversation=1&draft=test returned ${messagesPage.status}`,
  });

  return checks;
}

function truncate(value: string, maxLength: number) {
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, maxLength - 3)}...`;
}

async function withDevServer<T>(
  projectRoot: string,
  baseUrl: string,
  callback: () => Promise<T>
): Promise<T> {
  const parsedUrl = new URL(baseUrl);
  const port = parsedUrl.port ? Number(parsedUrl.port) : 3000;

  const devCommand = `npm run dev -- --port ${port}`;
  const child = spawn(devCommand, {
    cwd: projectRoot,
    env: {
      ...process.env,
      PORT: String(port),
    },
    shell: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  let stdoutTail = '';
  let stderrTail = '';

  child.stdout.on('data', (chunk: Buffer) => {
    const text = chunk.toString();
    stdoutTail = `${stdoutTail}${text}`.slice(-2000);
  });

  child.stderr.on('data', (chunk: Buffer) => {
    const text = chunk.toString();
    stderrTail = `${stderrTail}${text}`.slice(-2000);
  });

  try {
    const ready = await waitForServer(baseUrl, 120000);
    if (!ready) {
      throw new Error(
        `Dev server did not become ready at ${baseUrl} within timeout. Recent output:\n${stdoutTail}\n${stderrTail}`
      );
    }

    return await callback();
  } finally {
    await new Promise<void>((resolve) => {
      const timeout = setTimeout(() => {
        if (!child.killed) {
          child.kill('SIGKILL');
        }
        resolve();
      }, 5000);

      child.once('exit', () => {
        clearTimeout(timeout);
        resolve();
      });

      if (!child.killed) {
        child.kill('SIGTERM');
      }
    });
  }
}

async function main() {
  const projectRoot = process.cwd();
  const staticChecks = await runStaticFlowChecks(projectRoot);
  printCheckSummary('Static flow checks', staticChecks);

  const allResults: CheckResult[] = [...staticChecks];

  if (options.withDevProbes) {
    console.log(`\nRunning live endpoint probes against ${options.baseUrl} ...`);

    const probeChecks = await withDevServer(projectRoot, options.baseUrl, async () =>
      runEndpointProbes(options.baseUrl, options.requireDb)
    );

    printCheckSummary('Endpoint probe checks', probeChecks);
    allResults.push(...probeChecks);
  } else {
    console.log('\nSkipping endpoint probes (pass --with-dev-probes to enable).');
  }

  const failed = allResults.filter((result) => !result.ok);
  if (failed.length > 0) {
    console.error(`\nSmoke checks failed: ${failed.length} issue(s).`);
    process.exit(1);
  }

  console.log('\nAll smoke checks passed.');
}

void main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`\nSmoke runner failed: ${message}`);
  process.exit(1);
});
