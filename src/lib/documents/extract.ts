import "server-only";

import mammoth from "mammoth";
import { extractText, getDocumentProxy } from "unpdf";

/** MIME types accepted for document ingestion, mapped to a short label. */
export const DOCUMENT_MIME_TYPES: Record<string, string> = {
  "application/pdf": "PDF",
  "text/plain": "Text",
  "text/markdown": "Markdown",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
    "Word document",
};

export const ACCEPTED_DOCUMENT_MIME_TYPES = Object.keys(DOCUMENT_MIME_TYPES);

export function isSupportedDocumentType(mimeType: string): boolean {
  return mimeType in DOCUMENT_MIME_TYPES;
}

/**
 * Extracts plain text from a supported document buffer. Throws if the type is
 * unsupported or the file yields no readable text (e.g. a scanned/image PDF).
 */
export async function extractDocumentText(
  buffer: ArrayBuffer,
  mimeType: string,
  filename: string,
): Promise<string> {
  let text: string;

  switch (mimeType) {
    case "application/pdf": {
      const pdf = await getDocumentProxy(new Uint8Array(buffer));
      const result = await extractText(pdf, { mergePages: true });
      text = Array.isArray(result.text) ? result.text.join("\n") : result.text;
      break;
    }
    case "application/vnd.openxmlformats-officedocument.wordprocessingml.document": {
      const result = await mammoth.extractRawText({
        buffer: Buffer.from(buffer),
      });
      text = result.value;
      break;
    }
    case "text/plain":
    case "text/markdown": {
      text = new TextDecoder().decode(buffer);
      break;
    }
    default:
      throw new Error(`Unsupported document type: ${mimeType}`);
  }

  const trimmed = text.trim();
  if (!trimmed) {
    throw new Error(
      `No readable text found in "${filename}". Scanned/image-only files aren't supported.`,
    );
  }
  return trimmed;
}
