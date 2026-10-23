import { createCanvas } from '@scribe.js/canvas';
import { PDFDocument } from 'pdf-lib';

async function testMultipage() {
  console.log('Generating 2-page scanned PDF...');
  
  // Page 1
  const c1 = createCanvas(800, 1000);
  const ctx1 = c1.getContext('2d');
  ctx1.fillStyle = '#ffffff';
  ctx1.fillRect(0, 0, 800, 1000);
  ctx1.fillStyle = '#000000';
  ctx1.font = 'bold 22px sans-serif';
  ctx1.fillText('SECTION 1: FINANCIAL BENEFIT SCHEDULE', 50, 100);
  ctx1.font = '16px sans-serif';
  ctx1.fillText('Category A Households receive an upfront grant of Rs. 45,000.', 50, 160);

  // Page 2
  const c2 = createCanvas(800, 1000);
  const ctx2 = c2.getContext('2d');
  ctx2.fillStyle = '#ffffff';
  ctx2.fillRect(0, 0, 800, 1000);
  ctx2.fillStyle = '#000000';
  ctx2.font = 'bold 22px sans-serif';
  ctx2.fillText('SECTION 2: COMPLIANCE TIMELINE AND APPEALS', 50, 100);
  ctx2.font = '16px sans-serif';
  ctx2.fillText('All inspection reports must be filed by 28 November 2026.', 50, 160);

  const png1 = c1.toBuffer('image/png');
  const png2 = c2.toBuffer('image/png');

  const doc = await PDFDocument.create();
  const img1 = await doc.embedPng(png1);
  const img2 = await doc.embedPng(png2);

  const p1 = doc.addPage([800, 1000]);
  p1.drawImage(img1, { x: 0, y: 0, width: 800, height: 1000 });

  const p2 = doc.addPage([800, 1000]);
  p2.drawImage(img2, { x: 0, y: 0, width: 800, height: 1000 });

  const bytes = await doc.save();
  const b64 = Buffer.from(bytes).toString('base64');

  console.log('Uploading 2-page scanned document to production...');
  const res = await fetch('https://clario-navy.vercel.app/api/documents/process', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      filename: `Multipage_Scan_${Date.now()}.pdf`,
      fileData: b64,
      language: 'English',
    }),
  });

  const data = await res.json();
  console.log('Multipage Status:', res.status);
  console.log('Total Extracted Pages:', data.pages?.length);
  data.pages?.forEach((p) => {
    console.log(`- Page ${p.pageNumber}: "${p.extractedText.slice(0, 60)}..." (confidence: ${p.ocrConfidence})`);
  });

  // Test question targeting Page 2 specifically
  console.log('\nAsking question grounded in Page 2...');
  const askRes = await fetch('https://clario-navy.vercel.app/api/documents/ask', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      documentId: 'doc-multipage-scan',
      questionText: 'When must inspection reports be filed?',
      pages: data.pages,
    }),
  });

  const askData = await askRes.json();
  console.log('Answer:', askData.answerText);
  console.log('Citations:', askData.citations?.map((c) => `Page ${c.pageNumber}: ${c.supportingPassage}`));
}

testMultipage().catch(console.error);
