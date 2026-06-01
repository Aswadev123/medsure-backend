import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class FreeOcrService {
  private readonly logger = new Logger(FreeOcrService.name);
  private readonly apiUrl = process.env.FREE_OCR_API_URL || 'http://localhost:3002/api/ocr';
  private readonly apiKey = process.env.FREE_OCR_API_KEY;
  public enabled: boolean;

  constructor() {
    this.enabled = Boolean(this.apiUrl);
    if (this.enabled) this.logger.log('FreeOcr adapter enabled');
    else this.logger.log('FreeOcr adapter not configured');
  }

  /**
   * Accepts a document object: { url } | { text } | { base64 } | { buffer }
   * Returns normalized object similar to DocStrangeinService: { patientInfo, medicines, confidence, summary, raw }
   */
  async extract(document: any): Promise<any | null> {
    if (!this.enabled) return null;

    try {
      const payload: any = {};
      if (document.url) payload.url = document.url;
      else if (document.text) payload.text = document.text;
      else if (document.base64) payload.base64 = document.base64;
      else if (document.buffer) payload.base64 = Buffer.from(document.buffer).toString('base64');
      else {
        this.logger.warn('No suitable document content found for FreeOcr');
        return null;
      }

      // dynamic fetch
      let doFetch: typeof fetch;
      if (typeof fetch !== 'undefined') {
        doFetch = fetch;
      } else {
        const pkg = await import('node-fetch');
        // @ts-ignore
        doFetch = pkg.default || pkg;
      }

      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (this.apiKey) headers['Authorization'] = `Bearer ${this.apiKey}`;

      const res = await doFetch(this.apiUrl as string, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const txt = await res.text();
        this.logger.warn(`FreeOcr primary request failed: ${res.status} ${txt}`);
        // Try alternate header name if auth fails
        if (res.status === 401 || res.status === 403) {
          this.logger.log('Retrying FreeOcr with X-API-KEY header');
          const altHeaders: Record<string, string> = { 'Content-Type': 'application/json' };
          if (this.apiKey) altHeaders['X-API-KEY'] = String(this.apiKey);
          const altRes = await doFetch(this.apiUrl as string, {
            method: 'POST',
            headers: altHeaders,
            body: JSON.stringify(payload),
          });
          if (!altRes.ok) {
            const t = await altRes.text();
            this.logger.error(`FreeOcr alt request failed: ${altRes.status} ${t}`);
            return null;
          }
          const data = await altRes.json();
          return this.normalize(data);
        }
        return null;
      }

      const data = await res.json();
      return this.normalize(data);
    } catch (err: any) {
      this.logger.error('FreeOcr extract failed: ' + (err?.message || String(err)));
      return null;
    }
  }

  private normalize(data: any) {
    // Try to find text output
    const text = data.text || data.ocr_text || data.result || null;

    // medicines may be in several fields
    let meds: any[] = [];
    if (Array.isArray(data.medications) && data.medications.length) meds = data.medications;
    else if (Array.isArray(data.medicines) && data.medicines.length) meds = data.medicines;
    else if (Array.isArray(data.predictions) && data.predictions.length) meds = data.predictions;
    else if (Array.isArray(data.results) && data.results.length) meds = data.results;

    // Normalize simple arrays of strings
    meds = meds.map((m: any) => {
      if (typeof m === 'string') return { name: m };
      if (m.name || m.medication || m.drug) return { name: m.name || m.medication || m.drug, ...m };
      return m;
    });

    const normalized = {
      patientInfo: data.patient || data.patientInfo || data.patient_info || null,
      medicines: meds || [],
      confidence: data.confidence || data.score || null,
      summary: data.summary || (text ? (String(text).slice(0, 250)) : null),
      raw: data,
    };

    this.logger.log(`FreeOcr normalized medicines count: ${normalized.medicines.length}`);
    return normalized;
  }
}
