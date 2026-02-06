import puppeteer from 'puppeteer-core';

// IMPORTANT: only import sparticuz chromium when available
let chromium: any = null;
const isVercel = !!process.env.VERCEL;

if (isVercel) {
  // dynamic require prevents local bundling issues and keeps local dev simpler
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  chromium = require('@sparticuz/chromium').default;
}

type PdfOptions = {
  format?: 'A4' | 'Letter';
  printBackground?: boolean;
  margin?: { top?: string; right?: string; bottom?: string; left?: string };
};

function getLocalChromeExecutablePath(): string | undefined {
  // Common local paths (best effort). Adjust if needed.
  const candidates: string[] = [];

  if (process.platform === 'win32') {
    candidates.push(
      'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
      process.env.LOCALAPPDATA
        ? `${process.env.LOCALAPPDATA}\\Google\\Chrome\\Application\\chrome.exe`
        : ''
    );
  } else if (process.platform === 'darwin') {
    candidates.push(
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      '/Applications/Chromium.app/Contents/MacOS/Chromium'
    );
  } else if (process.platform === 'linux') {
    candidates.push(
      '/usr/bin/google-chrome',
      '/usr/bin/google-chrome-stable',
      '/usr/bin/chromium-browser',
      '/usr/bin/chromium',
      '/snap/bin/chromium'
    );
  }

  // Filter out empty strings and return first candidate
  return candidates.filter(Boolean)[0];
}

export async function generatePdfFromUrl(
  url: string,
  options: PdfOptions = {}
): Promise<Buffer> {
  const margin = options.margin ?? {
    top: '12mm',
    right: '10mm',
    bottom: '12mm',
    left: '10mm',
  };

  console.log(`[PDF] Generating PDF from URL: ${url}`);
  console.log(`[PDF] Environment: ${isVercel ? 'Vercel' : 'Local'}`);

  const launchOptions: any = {};

  if (isVercel) {
    if (!chromium) {
      throw new Error('@sparticuz/chromium is required on Vercel but not available');
    }
    const executablePath = await chromium.executablePath();
    launchOptions.args = chromium.args;
    launchOptions.defaultViewport = chromium.defaultViewport;
    launchOptions.executablePath = executablePath;
    launchOptions.headless = chromium.headless;
    console.log(`[PDF] Using Sparticuz Chromium: ${executablePath}`);
  } else {
    // Local dev: use system Chrome if available
    const executablePath = getLocalChromeExecutablePath();
    if (!executablePath) {
      throw new Error(
        'Chrome executable not found. Please install Google Chrome or set CHROME_EXECUTABLE_PATH environment variable.'
      );
    }
    launchOptions.headless = true;
    launchOptions.args = ['--no-sandbox', '--disable-setuid-sandbox'];
    launchOptions.executablePath = executablePath;
    console.log(`[PDF] Using local Chrome: ${executablePath}`);
  }

  // Allow override via environment variable
  if (process.env.CHROME_EXECUTABLE_PATH) {
    launchOptions.executablePath = process.env.CHROME_EXECUTABLE_PATH;
    console.log(`[PDF] Overriding with CHROME_EXECUTABLE_PATH: ${launchOptions.executablePath}`);
  }

  let browser;
  try {
    browser = await puppeteer.launch(launchOptions);
    console.log('[PDF] Browser launched successfully');

    const page = await browser.newPage();
    console.log(`[PDF] Navigating to: ${url}`);

    // Verify URL is reachable (optional check)
    try {
      const response = await page.goto(url, {
        waitUntil: 'networkidle0',
        timeout: 60000,
      });
      if (!response) {
        throw new Error('No response from URL');
      }
      const status = response.status();
      console.log(`[PDF] URL responded with status: ${status}`);
      if (status >= 400) {
        throw new Error(`URL returned error status: ${status}`);
      }
    } catch (err: any) {
      console.error(`[PDF] Failed to load URL: ${err.message}`);
      throw new Error(`Failed to load print URL: ${err.message}`);
    }

    console.log('[PDF] Generating PDF...');
    const pdf = await page.pdf({
      format: options.format ?? 'A4',
      printBackground: options.printBackground ?? true,
      margin,
    });

    console.log(`[PDF] PDF generated successfully (${pdf.length} bytes)`);
    return Buffer.from(pdf);
  } catch (err: any) {
    console.error('[PDF] Error during PDF generation:', err);
    throw err;
  } finally {
    if (browser) {
      await browser.close();
      console.log('[PDF] Browser closed');
    }
  }
}
