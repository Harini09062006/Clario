import { createCanvas } from '@scribe.js/canvas';
import { PDFDocument } from 'pdf-lib';

async function testProd() {
  console.log('Generating pure scanned image PDF...');
  const canvas = createCanvas(800, 1000);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, 800, 1000);
  ctx.fillStyle = '#000000';
  ctx.font = 'bold 22px sans-serif';
  ctx.fillText('TAMIL NADU CLEAN ENERGY AND ROOFTOP SOLAR INITIATIVE 2026', 40, 80);
  ctx.font = '16px sans-serif';
  ctx.fillText('Clause 1.1: Direct capital subsidy of Rs. 65,000 per rooftop solar unit.', 40, 140);
  ctx.fillText('Clause 1.2: Annual Household Income Ceiling is Rs. 3,00,000.', 40, 180);
  ctx.fillText('Clause 1.3: Application Submission Deadline is 15 October 2026.', 40, 220);

  const png = canvas.toBuffer('image/png');
  const doc = await PDFDocument.create();
  const img = await doc.embedPng(png);
  const page = doc.addPage([800, 1000]);
  page.drawImage(img, { x: 0, y: 0, width: 800, height: 1000 });
  const bytes = await doc.save();
  const b64 = Buffer.from(bytes).toString('base64');

  console.log('Sending scanned PDF to https://clario-navy.vercel.app/api/documents/process ...');
  const t0 = Date.now();
  const res = await fetch('https://clario-navy.vercel.app/api/documents/process', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      filename: `Scanned_Solar_Circular_${Date.now()}.pdf`,
      fileData: b64,
      language: 'English',
    }),
  });

  console.log(`HTTP Status: ${res.status} in ${Date.now() - t0}ms`);
  const data = await res.json();
  console.log('Response body:', JSON.stringify(data, null, 2));

  if (res.ok && data.pages?.length > 0) {
    console.log('\n--- Testing Ask on Production with Scanned Pages ---');
    const askRes = await fetch('https://clario-navy.vercel.app/api/documents/ask', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        documentId: 'scanned-solar-doc',
        questionText: 'What is the direct capital subsidy amount for rooftop solar?',
        pages: data.pages,
      }),
    });
    console.log('Ask Status:', askRes.status);
    const askData = await askRes.json();
    console.log('Ask Answer:', askData.answerText);
    console.log('Ask Citations:', askData.citations);
  }
}

testProd().catch(console.error);
