import puppeteer, { type Browser } from "puppeteer";
import type { MonthlyReportMetrics } from "./report-data.service";
import { generateReportHTML } from "./templates/monthly-report.template";

/**
 * Service for generating PDFs from HTML templates using Puppeteer
 */
export class PDFGeneratorService {
  private browser: Browser | null = null;

  /**
   * Initialize Puppeteer browser instance
   */
  async initialize(): Promise<void> {
    if (!this.browser) {
      console.log("[PDFGenerator] Launching Puppeteer browser...");
      
      // Use system Chromium installed via Nix
      const chromiumPath = process.env.CHROMIUM_PATH || '/nix/store/zi4f80l169xlmivz8vja8wlphq74qqk0-chromium-125.0.6422.141/bin/chromium';
      
      this.browser = await puppeteer.launch({
        headless: true,
        executablePath: chromiumPath,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu'
        ]
      });
      console.log("[PDFGenerator] Browser launched successfully");
    }
  }

  /**
   * Close Puppeteer browser instance
   */
  async close(): Promise<void> {
    if (this.browser) {
      console.log("[PDFGenerator] Closing browser...");
      await this.browser.close();
      this.browser = null;
      console.log("[PDFGenerator] Browser closed");
    }
  }

  /**
   * Generate PDF buffer from monthly report metrics
   */
  async generateMonthlyReportPDF(
    metrics: MonthlyReportMetrics,
    userEmail: string
  ): Promise<Buffer> {
    try {
      // Ensure browser is initialized
      await this.initialize();

      if (!this.browser) {
        throw new Error("Browser not initialized");
      }

      console.log(`[PDFGenerator] Generating report for ${userEmail} (${metrics.month})`);

      // Create a new page
      const page = await this.browser.newPage();

      try {
        // Generate HTML content
        const html = generateReportHTML(metrics, userEmail);

        // Set viewport for consistent rendering
        await page.setViewport({
          width: 1200,
          height: 1600,
          deviceScaleFactor: 2, // Higher quality rendering
        });

        // Load HTML content
        await page.setContent(html, {
          waitUntil: 'networkidle0', // Wait for all resources to load
          timeout: 30000, // 30 second timeout
        });

        // Wait for Chart.js to render charts (simple delay approach to avoid esbuild conflicts)
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Generate PDF
        const pdfData = await page.pdf({
          format: 'A4',
          printBackground: true,
          margin: {
            top: '20px',
            right: '20px',
            bottom: '20px',
            left: '20px',
          },
          displayHeaderFooter: false,
        });

        // Convert Uint8Array to Buffer
        const pdfBuffer = Buffer.from(pdfData);

        console.log(`[PDFGenerator] PDF generated successfully (${pdfBuffer.length} bytes)`);

        return pdfBuffer;
      } finally {
        // Always close the page
        await page.close();
      }
    } catch (error) {
      console.error("[PDFGenerator] Failed to generate PDF:", error);
      throw error;
    }
  }

  /**
   * Generate PDF and save to filesystem
   * This is a convenience method that combines generation and storage
   */
  async generateAndSave(
    metrics: MonthlyReportMetrics,
    userEmail: string,
    filename: string
  ): Promise<{ buffer: Buffer; checksum: string }> {
    const buffer = await this.generateMonthlyReportPDF(metrics, userEmail);
    
    // Calculate checksum
    const crypto = await import('crypto');
    const checksum = crypto.createHash('md5').update(buffer).digest('hex');

    return { buffer, checksum };
  }
}

/**
 * Singleton instance for PDF generation
 */
export const pdfGenerator = new PDFGeneratorService();

/**
 * Gracefully close browser on process exit
 */
process.on('beforeExit', async () => {
  await pdfGenerator.close();
});

process.on('SIGINT', async () => {
  await pdfGenerator.close();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await pdfGenerator.close();
  process.exit(0);
});
