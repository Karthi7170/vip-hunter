declare module "pdf-parse" {
  export type PDFParseResult = {
    text: string;
    numpages?: number;
    numrender?: number;
    info?: Record<string, unknown>;
    metadata?: unknown;
    version?: string;
  };

  export default function pdfParse(
    dataBuffer: Buffer | Uint8Array,
    options?: Record<string, unknown>,
  ): Promise<PDFParseResult>;
}
