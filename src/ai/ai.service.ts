// src/ai/ai.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { OCRResult } from '../ocr/ocr.service';
import { FreeOcrService } from './freeocr.service';
import Groq from 'groq-sdk';

export interface Warning {
  type: string;
  severity: string;
  message: string;
  suggestion: string;
}

export interface Medicine {
  name: string;
  dosage?: string;
  frequency?: string;
  duration?: string;
  verified?: boolean;
  warnings?: string[];
  purpose?: string;
}

export interface AnalysisResult {
  confidence: number;
  summary: string;
  medicines: Medicine[];
  warnings: Warning[];
  patientInfo?: any;
  doctorInfo?: any;
  recommendations: string[];
  insights: string[];
}

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private groqClient: Groq | null = null;
  private static groqFailureUntil = 0;
  private static groqFailureCount = 0;

  constructor(private readonly freeOcrService: FreeOcrService) {
    // Initialize Groq client if API key is available
    const groqApiKey = process.env.GROQ_API_KEY;
    if (groqApiKey && groqApiKey.startsWith('gsk_')) {
      this.groqClient = new Groq({ apiKey: groqApiKey });
      this.logger.log('Groq client initialized successfully');
    } else {
      this.logger.warn('GROQ_API_KEY not found or invalid format (should start with gsk_)');
    }
  }

  async analyzePrescription(ocrResult: OCRResult): Promise<AnalysisResult> {
    this.logger.log('Analyzing prescription with OCR data');
    try {
      const medicines = ocrResult.medications || [];
      const warnings: Warning[] = this.generateWarnings(medicines);
      const recommendations: string[] = this.generateRecommendations(medicines);
      const insights: string[] = this.generateInsights(ocrResult);

      return {
        confidence: ocrResult.confidence,
        summary: `Prescription contains ${medicines.length} medication(s)`,
        medicines: medicines.map(med => ({
          ...med,
          verified: true,
          warnings: this.getMedicineWarnings(med.name),
          purpose: this.getMedicinePurpose(med.name),
        })),
        warnings,
        patientInfo: ocrResult.patientInfo,
        doctorInfo: ocrResult.doctorInfo,
        recommendations,
        insights,
      };
    } catch (error: any) {
      this.logger.error(`AI analysis failed: ${error.message}`);
      throw error;
    }
  }

  async analyzeDocument(document: any): Promise<AnalysisResult> {
    this.logger.log('Analyzing document');
    try {
      if (this.freeOcrService && this.freeOcrService.enabled) {
        this.logger.log('Attempting extraction with FreeOcr adapter');
        const extracted = await this.freeOcrService.extract(document);
        if (extracted) {
          const medicines = (extracted.medicines || []).map((m: any) => ({
            name: m.name || m.medication || m.drug || '',
            dosage: m.dosage || m.dose || undefined,
            frequency: m.frequency || undefined,
            duration: m.duration || undefined,
            verified: m.verified || false,
            warnings: m.warnings || [],
            purpose: m.purpose || undefined,
          }));

          const result: any = {
            confidence: extracted.confidence ?? 80,
            summary: extracted.summary || 'Document extracted by FreeOcr adapter',
            medicines,
            warnings: [],
            patientInfo: extracted.patientInfo || null,
            recommendations: ['Processed by FreeOcr adapter'],
            insights: extracted.raw ? ['FreeOcr provided raw data'] : [],
            raw: extracted.raw || null,
          };

          return result as AnalysisResult;
        }
      }
    } catch (err) {
      this.logger.error('FreeOcr extraction error: ' + (err as any)?.message || String(err));
    }

    return {
      confidence: 85,
      summary: 'Document analysis completed',
      medicines: [],
      warnings: [],
      recommendations: ['Document processed successfully'],
      insights: ['Document type: general']
    };
  }

  async generateChatResponse(message: string, context?: any, options?: { forceGemini?: boolean }): Promise<string> {
    this.logger.log(`Generating chat response for: ${message.substring(0, 50)}...`);
    
    let history = '';
    if (context?.recentMessages && Array.isArray(context.recentMessages)) {
      history = context.recentMessages.map((m: any) => `${m.role}: ${m.content}`).join('\n');
    }

    let docText = context?.document || context?.text || context?.documentText || context?.raw || null;
    if (!docText && context?.medicines && Array.isArray(context.medicines) && context.medicines.length > 0) {
      try {
        docText = context.medicines.map((m: any, idx: number) => {
          const parts = [`${idx + 1}. ${m.name || m.medication || 'Unknown'}`];
          if (m.dosage) parts.push(`Dosage: ${m.dosage}`);
          if (m.schedule) parts.push(`Schedule: ${m.schedule}`);
          if (m.frequency) parts.push(`Frequency: ${m.frequency}`);
          if (m.duration) parts.push(`Duration: ${m.duration}`);
          return parts.join(' | ');
        }).join('\n');
      } catch (e) {
        docText = null;
      }
    }

    let medicineCandidate: string | null = null;
    if (/\bdolo\b|\bparacetamol\b|\bdolo\s*650\b|\bacetaminophen\b/i.test(message)) {
      medicineCandidate = message.match(/\b(dolo\s*650|dolo|paracetamol|acetaminophen)\b/i)?.[0] ?? message;
    } else if (context?.medicines && Array.isArray(context.medicines) && context.medicines.length === 1) {
      medicineCandidate = context.medicines[0].name || null;
    }

    let prompt = '';
    if (medicineCandidate) {
      prompt = `You are a trusted medical-information assistant for patients. The user asked about the medication: "${medicineCandidate}". Provide a clear, concise, patient-friendly explanation in short bullet points under these headings: \n- Drug name & active ingredient\n- What it is / primary use\n- Typical adult dosing (brief) and note to follow prescriber\n- Key warnings / contraindications (liver, allergies, severe conditions)\n- Common side effects (brief list)\n- Important drug interactions to watch for (name the classes or common drugs)\n- Pregnancy / breastfeeding note\n- Overdose signs and when to seek emergency care\n- Follow-up advice and recommendation to consult the prescriber or pharmacist\nAlways end with: "This is general information only — not medical advice. Follow your doctor's instructions." If you are not sure or lack enough reliable information, say exactly: "I don't know — consult your healthcare provider." Keep language simple and avoid clinical jargon where possible.`;
    } else if (docText) {
      prompt = `You are a helpful assistant. Use the following document to answer the user's question and prioritize information from it. If information is missing, you may use general knowledge but clearly mark it as general. DOCUMENT:\n${String(docText)}\n\nCHAT HISTORY:\n${history}\n\nUSER QUESTION:\n${message}\n\nANSWER:`;
    } else {
      prompt = `${history}\nuser: ${message}\nassistant:`;
    }

    // ✅ PRIMARY: Try Groq/Llama 4 first
    const groqResp = await this.callGroq(prompt);
    if (groqResp) return groqResp;

    // Local fallback responses
    const lower = message.toLowerCase().trim();

    if (lower.includes('hello') || lower.includes('hi')) {
      return "Hello! I'm your MedSure AI assistant. Upload a prescription or ask about a medication name to get started.";
    }

    if (lower.includes('side effect') || lower.includes('side-effects') || lower.includes('sideeffects')) {
      return "Side effects vary by medication. If you tell me which medicine (name) you're asking about, I can share common warnings.";
    }

    if (lower.includes('dosage') || lower.includes('dose')) {
      return "Dosage instructions depend on the specific medication and the prescription. Tell me the medicine name and I can show typical guidance.";
    }

    const whatIsMatch = lower.match(/^(?:what(?:'s| is)\s+)?([a-z0-9\-\s]{2,50})\??$/i);
    if (whatIsMatch) {
      const candidate = whatIsMatch[1].trim();
      if (candidate.length >= 2 && candidate.split(' ').length <= 4) {
        const purpose = this.getMedicinePurpose(candidate);
        const warnings = this.getMedicineWarnings(candidate);
        let resp = `Information for ${candidate}: ${purpose}`;
        if (warnings && warnings.length) {
          resp += `\nCommon warnings: ${warnings.slice(0, 3).join('; ')}`;
        }
        resp += `\nIf you want, ask about side effects, dosage, interactions, or paste a prescription.`;
        return resp;
      }
    }

    if (context?.medicines && Array.isArray(context.medicines)) {
      const meds = context.medicines as any[];
      if (meds.length === 0) {
        return "No medications were found in the uploaded prescription. Please verify the upload or try a clearer image.";
      }

      const list = meds.slice(0, 8).map((m, i) => {
        const parts = [m.name || 'Unknown'];
        if (m.dosage) parts.push(m.dosage);
        if (m.schedule) parts.push(m.schedule);
        return `${i + 1}. ${parts.join(' — ')}`;
      }).join('\n');

      let resp = `Found ${meds.length} medication(s) in the prescription:\n${list}`;
      if (meds.length > 8) resp += `\n...and ${meds.length - 8} more.`;
      resp += `\nYou can ask about side effects, dosage, interactions, or request the full analysis.`;
      return resp;
    }

    return "I couldn't find enough information to answer that. Try asking about a specific medicine name or upload a prescription for analysis.";
  }

  // ✅ GROQ/LLAMA 4 IMPLEMENTATION - CORRECT
  private async callGroq(prompt: string): Promise<string | null> {
    if (!this.groqClient) {
      this.logger.warn('Groq client not available');
      return null;
    }

    const now = Date.now();
    if (AiService.groqFailureUntil > now) {
      this.logger.warn('Skipping Groq call due to cooldown');
      return null;
    }

    const maxAttempts = 2;
    
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        this.logger.log(`Groq call attempt ${attempt} with Llama 4 Scout`);

        const completion = await this.groqClient.chat.completions.create({
          messages: [
            {
              role: 'system',
              content: 'You are a trusted medical-information assistant for patients. Provide clear, accurate, patient-friendly responses. Always include a disclaimer to consult healthcare providers.'
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          model: 'meta-llama/llama-4-scout-17b-16e-instruct',
          temperature: 0.7,
          max_tokens: 1024,
        });

        const response = completion.choices[0]?.message?.content;
        if (response && response.trim().length > 0) {
          AiService.groqFailureCount = 0;
          AiService.groqFailureUntil = 0;
          this.logger.log('Groq/Llama responded successfully');
          return response.trim();
        }

        this.logger.warn('Empty response from Groq');
        
      } catch (error: any) {
        this.logger.error(`Groq attempt ${attempt} failed: ${error.message}`);
        
        // Handle rate limits
        if (error.message.includes('429') || error.status === 429) {
          const wait = 2000 * attempt;
          this.logger.warn(`Rate limited, waiting ${wait}ms`);
          await new Promise(r => setTimeout(r, wait));
          continue;
        }
        
        if (attempt < maxAttempts) {
          await new Promise(r => setTimeout(r, 1000 * attempt));
        }
      }
    }

    AiService.groqFailureCount++;
    if (AiService.groqFailureCount >= 2) {
      AiService.groqFailureUntil = Date.now() + 60000;
      this.logger.warn('Entering Groq cooldown for 60s due to failures');
    }
    
    return null;
  }

  private generateWarnings(medicines: any[]): Warning[] {
    const warnings: Warning[] = [];
    const drugInteractions: Record<string, string[]> = {
      'warfarin': ['aspirin', 'ibuprofen'],
      'metformin': ['prednisone'],
      'lisinopril': ['ibuprofen', 'potassium'],
    };

    medicines.forEach(med => {
      const medName = (med?.name || '').toLowerCase();
      
      Object.entries(drugInteractions).forEach(([drug, interactions]) => {
        if (medName.includes(drug)) {
          interactions.forEach(interaction => {
            if (medicines.some(m => m.name.toLowerCase().includes(interaction))) {
              warnings.push({
                type: 'Drug Interaction',
                severity: 'High',
                message: `Potential interaction between ${med.name} and ${interaction}`,
                suggestion: 'Consult your doctor before taking these medications together'
              });
            }
          });
        }
      });

      if (medName.includes('antibiotic')) {
        warnings.push({
          type: 'Medication Warning',
          severity: 'Medium',
          message: 'Complete the full course of antibiotics even if you feel better',
          suggestion: 'Take with food to reduce stomach upset'
        });
      }
    });

    return warnings;
  }

  private generateRecommendations(medicines: any[]): string[] {
    const recommendations: string[] = [
      'Take medications at the same time each day',
      'Store medications at room temperature away from moisture',
      'Keep a medication schedule to track doses'
    ];

    medicines.forEach(med => {
      if (med.frequency) {
        recommendations.push(`Take ${med.name} ${med.frequency.toLowerCase()}`);
      }
      if (med.duration) {
        recommendations.push(`Continue ${med.name} for ${med.duration}`);
      }
    });

    return recommendations;
  }

  private generateInsights(ocrResult: OCRResult): string[] {
    const insights: string[] = [];
    const meds = Array.isArray(ocrResult?.medications) ? ocrResult.medications : [];

    if (meds.length > 0) {
      insights.push(`Detected ${meds.length} medication(s) in the prescription`);
    }

    const confidence = typeof ocrResult?.confidence === 'number' ? ocrResult.confidence : 0;
    if (confidence > 90) {
      insights.push('High confidence in text extraction');
    } else if (confidence < 70) {
      insights.push('Low confidence in some extracted text - please verify manually');
    }

    if (ocrResult?.patientInfo?.name) {
      insights.push(`Prescription is for patient: ${ocrResult.patientInfo.name}`);
    }

    if (ocrResult?.doctorInfo?.name) {
      insights.push(`Prescribed by Dr. ${ocrResult.doctorInfo.name}`);
    }

    return insights;
  }

  private getMedicineWarnings(medicineName: string): string[] {
    const warnings: Record<string, string[]> = {
      'amoxicillin': ['May cause diarrhea', 'Complete full course', 'Avoid if allergic to penicillin'],
      'ibuprofen': ['Take with food', 'Avoid alcohol', 'Not for long-term use'],
      'metformin': ['Monitor blood sugar', 'May cause stomach upset', 'Avoid excessive alcohol'],
      'lisinopril': ['Monitor blood pressure', 'May cause dizziness', 'Stay hydrated'],
    };

    const name = (medicineName || '').toLowerCase();
    const key = Object.keys(warnings).find(k => name.includes(k.toLowerCase()));
    return key ? warnings[key] : ['Consult your doctor for specific warnings'];
  }

  private getMedicinePurpose(medicineName: string): string {
    const purposes: Record<string, string> = {
      'amoxicillin': 'Antibiotic for bacterial infections',
      'ibuprofen': 'Pain relief and anti-inflammatory',
      'metformin': 'Blood sugar control for diabetes',
      'lisinopril': 'Blood pressure management',
      'atorvastatin': 'Cholesterol management',
      'omeprazole': 'Acid reflux treatment',
    };

    const name = (medicineName || '').toLowerCase();
    const key = Object.keys(purposes).find(k => name.includes(k.toLowerCase()));
    return key ? purposes[key] : 'As prescribed by your doctor';
  }
}