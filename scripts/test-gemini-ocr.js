import { GoogleGenAI } from '@google/genai';
import { PDFDocument } from 'pdf-lib';
import dotenv from 'dotenv';
dotenv.config();

async function test() {
  console.log('Testing Gemini OCR directly...');
  const doc = await PDFDocument.create();
  const page = doc.addPage([500, 500]);
  const bytes = await doc.save();
  const b64 = Buffer.from(bytes).toString('base64');
  
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  const model = process.env.GEMINI_MODEL || 'gemini-3.5-flash';
  console.log('Using model:', model);

  try {
    const res = await ai.models.generateContent({
      model: model,
      contents: [
        {
          role: 'user',
          parts: [
            {
              inlineData: {
                mimeType: 'application/pdf',
                data: b64,
              },
            },
            {
              text: 'Extract all text verbatim from this document. Output JSON: [{"pageNumber": 1, "text": "..."}]',
            },
          ],
        },
      ],
    });
    console.log('Result text:', res.text);
  } catch (err) {
    console.error('Gemini OCR Error:', err);
  }
}

test();
