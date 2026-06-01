import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class DocStrangeinService {
  private readonly logger = new Logger(DocStrangeinService.name);
  private readonly apiUrl = process.env.DOCSTRANGEIN_API_URL;
  private readonly apiKey = process.env.DOCSTRANGEIN_API_KEY;
  public enabled: boolean;

  constructor() {
    this.enabled = Boolean(this.apiUrl && this.apiKey);
    if (this.enabled) this.logger.log('DocStrangein adapter enabled');
    else this.logger.log('DocStrangein adapter not configured');
  }

  /**
   * Extract structured data from a document object.
   * document may be { url }, { text }, or { base64 }
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
        this.logger.warn('No suitable document content found for DocStrangein');
        return null;
      }

      if (!this.apiUrl) {
        this.logger.error('DOCSTRANGEIN_API_URL not configured');
        return null;
      }

      // Use global fetch when available, otherwise dynamically import node-fetch
      let doFetch: typeof fetch;
      if (typeof fetch !== 'undefined') {
        doFetch = fetch;
      } else {
        const pkg = await import('node-fetch');
        // node-fetch exports default function
        // @ts-ignore
        doFetch = pkg.default || pkg;
      }

      const res = await doFetch(this.apiUrl as string, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify(payload),
      });

      this.logger.log(`DocStrangein request payload: ${JSON.stringify(payload).slice(0, 1000)}`);

      let response = res;
      if (!response.ok) {
        const text = await response.text();
        this.logger.warn(`DocStrangein primary request failed: ${response.status} ${text}`);

        // Retry with alternate header formats if auth issue
        if (response.status === 401 || response.status === 403) {
          this.logger.log('Retrying DocStrangein request with alternate API key header');
          const altHeaders: Record<string, string> = { 'Content-Type': 'application/json' };
          if (this.apiKey) altHeaders['X-API-KEY'] = String(this.apiKey);
          const altRes = await doFetch(this.apiUrl as string, {
            method: 'POST',
            headers: altHeaders,
            body: JSON.stringify(payload),
          });
          response = altRes;
        } else {
          return null;
        }
      }

      if (!response.ok) {
        const text = await response.text();
        this.logger.error(`DocStrangein API error after retry: ${response.status} ${text}`);
        return null;
      }

      const data = await response.json();
      this.logger.log(`DocStrangein raw response keys: ${Object.keys(data).join(', ')}`);

      // Try to normalize common shapes (direct medicines, or nested 'predictions')
      let meds: any[] = [];
      if (data.medicines || data.medications || data.drugs) {
        meds = data.medicines || data.medications || data.drugs;
      } else if (data.predictions && Array.isArray(data.predictions)) {
        data.predictions.forEach((p: any) => {
          // Nanonets-like: p.extractions or p.result
          if (p.extractions) {
            Object.values(p.extractions).forEach((val: any) => {
              if (Array.isArray(val)) {
                val.forEach(v => {
                  if (v.value && typeof v.value === 'string') {
                    meds.push({ name: v.value });
                  }
                });
              } else if (val && val.value) {
                meds.push({ name: val.value });
              }
            });
          }
          if (p.result && Array.isArray(p.result)) {
            p.result.forEach((r: any) => {
              if (r.label && r.value) meds.push({ name: r.value });
            });
          }
        });
      } else if (data.prediction && Array.isArray(data.prediction)) {
        data.prediction.forEach((p: any) => {
          if (p.extractions) {
            Object.values(p.extractions).forEach((val: any) => {
              if (Array.isArray(val)) val.forEach(v => meds.push({ name: v.value || v }));
            });
          }
        });
      }

      const normalized = {
        patientInfo: data.patient || data.patientInfo || data.patient_info || null,
        medicines: meds,
        confidence: data.confidence || data.score || null,
        summary: data.summary || data.excerpt || null,
        raw: data,
      };

      this.logger.log(`DocStrangein normalized medicines count: ${normalized.medicines.length}`);

      return normalized;
    } catch (error: any) {
      this.logger.error('DocStrangein extract failed: ' + (error?.message || String(error)));
      return null;
    }
  }
}
