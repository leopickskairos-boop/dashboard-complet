/**
 * PDF Monkey Service
 * Generates professional PDF reports using PDF Monkey API
 */

export interface PdfMonkeyDocument {
  id: string;
  status: 'pending' | 'success' | 'error';
  download_url: string | null;
  preview_url: string | null;
  errors: string[] | null;
}

export interface PdfMonkeyResponse {
  document?: PdfMonkeyDocument;
  document_card?: PdfMonkeyDocument;
}

export interface MonthlyReportPayload {
  // Header
  companyName: string;
  reportMonth: string;
  generatedDate: string;
  userEmail: string;
  
  // Executive Summary
  executiveSummary: {
    totalCalls: number;
    totalCallsChange: string;
    conversionRate: number;
    conversionRateChange: string;
    appointmentsTaken: number;
    appointmentsChange: string;
    performanceScore: number;
    performanceLabel: string;
    performanceColor: string;
  };
  
  // Core KPIs
  kpis: {
    totalCalls: number;
    totalCallsChange: string;
    activeCalls: number;
    activeCallsChange: string;
    conversionRate: string;
    conversionRateChange: string;
    averageDuration: string;
    averageDurationChange: string;
  };
  
  // Business Metrics
  business: {
    appointmentsTaken: number;
    appointmentsChange: string;
    appointmentConversionRate: string;
    appointmentConversionChange: string;
    afterHoursCalls: number;
    afterHoursChange: string;
    timeSavedHours: string;
    timeSavedChange: string;
    estimatedRevenue: string;
    revenueChange: string;
    roi: string;
    roiChange: string;
  };
  
  // Performance Score
  performanceScore: {
    score: number;
    label: string;
    color: string;
    previousScore: number;
    previousScoreChange: string;
  };
  
  // AI Recommendations
  recommendations: Array<{
    type: 'success' | 'alert' | 'info';
    title: string;
    message: string;
  }>;
  
  // Charts Data
  peakHours: Array<{
    hour: string;
    callCount: number;
  }>;
  
  callsByStatus: Array<{
    status: string;
    statusLabel: string;
    count: number;
    percentage: string;
    color: string;
  }>;
  
  // Enriched Data
  conversionResults: Array<{
    result: string;
    count: number;
    percentage: string;
  }>;
  
  clientMoods: Array<{
    mood: string;
    moodLabel: string;
    count: number;
    percentage: string;
    icon: string;
    isEstimated?: boolean;
  }>;
  
  serviceTypes: Array<{
    type: string;
    typeLabel: string;
    count: number;
    percentage: string;
  }>;
  
  appointmentsByDay: Array<{
    day: string;
    dayLabel: string;
    count: number;
  }>;
  
  topKeywords: Array<{
    keyword: string;
    count: number;
  }>;
  
  // Additional Metrics
  additionalMetrics: {
    returningClients: number;
    returningClientsPercent: string;
    upsellAccepted: number;
    upsellPercent: string;
    lastMinuteBookings: number;
    averageBookingConfidence: string;
    averageBookingDelayDays: string;
  };
  
  // Insights
  insights: {
    peakActivity: string;
    statusDistribution: string;
    monthComparison: string;
  };
  
  // CB Guarantee (if available)
  cbGuarantee?: {
    noShowRate: string;
    revenueRecovered: string;
    guaranteeValidationRate: string;
  };
}

const PDFMONKEY_API_URL = 'https://api.pdfmonkey.io/api/v1';

class PdfMonkeyService {
  private apiKey: string | undefined;
  private templateId: string | undefined;

  constructor() {
    this.apiKey = process.env.PDFMONKEY_API_KEY;
    this.templateId = process.env.PDFMONKEY_TEMPLATE_ID;
  }

  private getApiKey(): string {
    if (!this.apiKey) {
      this.apiKey = process.env.PDFMONKEY_API_KEY;
    }
    if (!this.apiKey) {
      throw new Error('PDFMONKEY_API_KEY is not configured');
    }
    return this.apiKey;
  }

  private getTemplateId(): string {
    if (!this.templateId) {
      this.templateId = process.env.PDFMONKEY_TEMPLATE_ID;
    }
    if (!this.templateId) {
      throw new Error('PDFMONKEY_TEMPLATE_ID is not configured');
    }
    return this.templateId;
  }

  /**
   * Generate a PDF synchronously (waits for completion)
   */
  async generatePdfSync(payload: MonthlyReportPayload, filename?: string): Promise<PdfMonkeyDocument> {
    const apiKey = this.getApiKey();
    const templateId = this.getTemplateId();

    console.log('[PdfMonkey] Generating PDF synchronously...');
    
    const response = await fetch(`${PDFMONKEY_API_URL}/documents/sync`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        document: {
          document_template_id: templateId,
          status: 'pending',
          payload,
          meta: {
            _filename: filename || `rapport-mensuel-${payload.reportMonth}.pdf`,
          },
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[PdfMonkey] API Error:', response.status, errorText);
      throw new Error(`PDF Monkey API error: ${response.status} - ${errorText}`);
    }

    const data: PdfMonkeyResponse = await response.json();
    
    // Sync endpoint returns document_card instead of document
    const document = data.document_card || data.document;
    
    if (!document) {
      throw new Error('No document returned from PDF Monkey');
    }

    if (document.status === 'error') {
      throw new Error(`PDF generation failed: ${document.errors?.join(', ') || 'Unknown error'}`);
    }

    console.log('[PdfMonkey] PDF generated successfully:', document.id);
    return document;
  }

  /**
   * Generate a PDF asynchronously (returns immediately)
   */
  async generatePdfAsync(payload: MonthlyReportPayload, filename?: string): Promise<PdfMonkeyDocument> {
    const apiKey = this.getApiKey();
    const templateId = this.getTemplateId();

    console.log('[PdfMonkey] Generating PDF asynchronously...');
    
    const response = await fetch(`${PDFMONKEY_API_URL}/documents`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        document: {
          document_template_id: templateId,
          status: 'pending',
          payload,
          meta: {
            _filename: filename || `rapport-mensuel-${payload.reportMonth}.pdf`,
          },
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[PdfMonkey] API Error:', response.status, errorText);
      throw new Error(`PDF Monkey API error: ${response.status} - ${errorText}`);
    }

    const data: PdfMonkeyResponse = await response.json();
    const document = data.document;
    
    if (!document) {
      throw new Error('No document returned from PDF Monkey');
    }

    console.log('[PdfMonkey] PDF generation started:', document.id);
    return document;
  }

  /**
   * Get document status and download URL
   */
  async getDocument(documentId: string): Promise<PdfMonkeyDocument> {
    const apiKey = this.getApiKey();

    const response = await fetch(`${PDFMONKEY_API_URL}/documents/${documentId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`PDF Monkey API error: ${response.status} - ${errorText}`);
    }

    const data: PdfMonkeyResponse = await response.json();
    const document = data.document;
    
    if (!document) {
      throw new Error('No document found');
    }

    return document;
  }

  /**
   * Download PDF content as Buffer
   */
  async downloadPdf(downloadUrl: string): Promise<Buffer> {
    console.log('[PdfMonkey] Downloading PDF from:', downloadUrl);
    
    const response = await fetch(downloadUrl);
    
    if (!response.ok) {
      throw new Error(`Failed to download PDF: ${response.status}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }

  /**
   * Check if service is configured
   */
  isConfigured(): boolean {
    return !!process.env.PDFMONKEY_API_KEY && !!process.env.PDFMONKEY_TEMPLATE_ID;
  }

  /**
   * Get configuration status
   */
  getConfigStatus(): { apiKey: boolean; templateId: boolean } {
    return {
      apiKey: !!process.env.PDFMONKEY_API_KEY,
      templateId: !!process.env.PDFMONKEY_TEMPLATE_ID,
    };
  }
}

export const pdfMonkeyService = new PdfMonkeyService();
