import { chromium } from 'playwright-core';

const USER_AGENTS = [
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:125.0) Gecko/20100101 Firefox/125.0',
];

// Statuses (and 0 = network error / connection dropped) where a plain HTTP retry
// won't help but a browser might succeed.
const BROWSER_FALLBACK_STATUSES = new Set([0, 402, 403, 429]);

// Statuses that are definitive failures — don't retry at all
const NO_RETRY_STATUSES = new Set([400, 401, 404, 410, 451]);

function randomUserAgent(): string {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function buildHeaders(url: string, userAgent: string): Record<string, string> {
  const origin = new URL(url).origin;
  return {
    'User-Agent': userAgent,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
    'Accept-Encoding': 'gzip, deflate, br',
    'Cache-Control': 'no-cache',
    Pragma: 'no-cache',
    Referer: origin + '/',
    'Sec-Fetch-Dest': 'document',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-Site': 'none',
    'Sec-Fetch-User': '?1',
    'Upgrade-Insecure-Requests': '1',
    DNT: '1',
  };
}

function parseStatus(err: Error): number {
  return parseInt(err.message.match(/HTTP (\d+)/)?.[1] ?? '0');
}

async function fetchWithHttp(url: string): Promise<string> {
  const response = await fetch(url, { headers: buildHeaders(url, randomUserAgent()) });
  if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`);
  return response.text();
}

async function fetchWithBrowser(url: string): Promise<string> {
  const executablePath = process.env['PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH'];
  const browser = await chromium.launch({
    headless: true,
    ...(executablePath ? { executablePath } : {}),
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  });
  try {
    const page = await browser.newPage();
    await page.setExtraHTTPHeaders(buildHeaders(url, randomUserAgent()));
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30_000 });
    return await page.content();
  } finally {
    await browser.close();
  }
}

export type FetchProgress = (
  sub: 'request' | 'capture' | 'browser',
  status: 'running' | 'done',
  message?: string,
) => void;

export async function fetchPage(
  url: string,
  options?: { retries?: number; onProgress?: FetchProgress },
): Promise<string> {
  const retries = options?.retries ?? 3;
  const onProgress = options?.onProgress ?? (() => {});
  let lastError: Error | undefined;

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      onProgress('request', 'running', 'Fetching via HTTP…');
      const html = await fetchWithHttp(url);
      onProgress('request', 'done', 'Loaded via HTTP');
      onProgress('capture', 'running', 'Extracting HTML…');
      onProgress('capture', 'done', 'HTML captured');
      return html;
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      const status = parseStatus(error);

      if (BROWSER_FALLBACK_STATUSES.has(status)) {
        console.log(`  ⚠ HTTP ${status} — retrying with headless browser…`);
        onProgress('request', 'done', 'HTTP blocked');
        onProgress('browser', 'running', 'Launching browser…');
        const html = await fetchWithBrowser(url);
        onProgress('browser', 'done', 'Loaded via browser');
        onProgress('capture', 'running', 'Extracting HTML…');
        onProgress('capture', 'done', 'HTML captured');
        return html;
      }

      if (NO_RETRY_STATUSES.has(status)) throw error;

      lastError = error;
      if (attempt < retries) await sleep(1000 * attempt);
    }
  }

  throw lastError ?? new Error(`Failed to fetch ${url}`);
}
