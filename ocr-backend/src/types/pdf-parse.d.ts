declare module 'pdf-parse' {
  interface PDFParseOptions {
    max?: number;
    pagerender?: (pageData: any) => string;
    version?: string;
  }

  interface PDFInfo {
    numpages?: number;
    numrender?: number;
    info?: any;
    metadata?: any;
    text?: string;
  }

  function pdf(data: Buffer | Uint8Array | string, options?: PDFParseOptions): Promise<PDFInfo>;

  export = pdf;
}
