/**
 * MBR (Monthly Business Report) PDF Generation Service
 * Uses Puppeteer for headless rendering with Chart.js support
 */

import puppeteer, { type Browser, type Page } from "puppeteer";
import crypto from "crypto";
import { MbrV1 } from "@shared/mbr-types";
import { generateMbrReportHTML } from "../templates/mbr-report.template";

export interface MbrPdfResult {
  buffer: Buffer;
  checksum: string;
  sizeBytes: number;
  generatedAt: string;
}

export class MbrPdfService {
  private browser: Browser | null = null;

  /**
   * Initialize Puppeteer browser instance
   */
  async initialize(): Promise<void> {
    if (!this.browser) {
      console.log("[MbrPdfService] Launching Puppeteer browser...");
      this.browser = await puppeteer.launch({
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu',
          '--font-render-hinting=none'
        ]
      });
      console.log("[MbrPdfService] Browser launched successfully");
    }
  }

  /**
   * Close Puppeteer browser instance
   */
  async close(): Promise<void> {
    if (this.browser) {
      console.log("[MbrPdfService] Closing browser...");
      await this.browser.close();
      this.browser = null;
      console.log("[MbrPdfService] Browser closed");
    }
  }

  /**
   * Wait for Chart.js charts to be fully rendered
   */
  private async waitForCharts(page: Page): Promise<void> {
    await Promise.race([
      page.evaluate(() => {
        return new Promise<void>((resolve) => {
          const checkCharts = () => {
            const charts = document.querySelectorAll('canvas');
            if (charts.length === 0) {
              resolve();
              return;
            }

            let allRendered = true;
            charts.forEach((canvas) => {
              if (canvas.width === 0 || canvas.height === 0) {
                allRendered = false;
              }
            });

            if (allRendered) {
              resolve();
            } else {
              setTimeout(checkCharts, 100);
            }
          };
          setTimeout(checkCharts, 500);
        });
      }),
      new Promise<void>((resolve) => {
        setTimeout(() => {
          console.warn("[MbrPdfService] Chart rendering timeout, proceeding anyway");
          resolve();
        }, 10000);
      })
    ]);
  }

  /**
   * Generate PDF buffer from MbrV1 data
   */
  async generatePdf(mbr: MbrV1): Promise<MbrPdfResult> {
    try {
      await this.initialize();

      if (!this.browser) {
        throw new Error("Browser not initialized");
      }

      console.log(`[MbrPdfService] Generating MBR PDF for ${mbr.tenant.name} (${mbr.tenant.period.month_label})`);

      const page = await this.browser.newPage();

      try {
        const html = generateMbrReportHTML(mbr);

        await page.setViewport({
          width: 1200,
          height: 1600,
          deviceScaleFactor: 2,
        });

        await page.setContent(html, {
          waitUntil: 'networkidle0',
          timeout: 30000,
        });

        await this.waitForCharts(page);
        await new Promise(resolve => setTimeout(resolve, 500));

        const pdfData = await page.pdf({
          format: 'A4',
          printBackground: true,
          margin: {
            top: '0',
            right: '0',
            bottom: '0',
            left: '0',
          },
          displayHeaderFooter: false,
          preferCSSPageSize: true,
        });

        const buffer = Buffer.from(pdfData);
        const checksum = crypto.createHash('md5').update(buffer).digest('hex');

        console.log(`[MbrPdfService] PDF generated successfully (${buffer.length} bytes, checksum: ${checksum.slice(0, 8)}...)`);

        return {
          buffer,
          checksum,
          sizeBytes: buffer.length,
          generatedAt: new Date().toISOString(),
        };
      } finally {
        await page.close();
      }
    } catch (error) {
      console.error("[MbrPdfService] Failed to generate PDF:", error);
      throw error;
    }
  }
}

export const mbrPdfService = new MbrPdfService();

process.on('beforeExit', async () => {
  await mbrPdfService.close();
});

process.on('SIGINT', async () => {
  await mbrPdfService.close();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await mbrPdfService.close();
  process.exit(0);
});
