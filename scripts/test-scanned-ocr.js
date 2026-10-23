import { createCanvas } from '@scribe.js/canvas';
import { PDFDocument } from 'pdf-lib';
import dotenv from 'dotenv';
dotenv.config();

async function createScannedPdfWithImage() {
  const canvas = createCanvas(800, 1000);
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, 800, 1000);

  ctx.fillStyle = '#000000';
  ctx.font = 'bold 24px sans-serif';
  ctx.fillText('TAMIL NADU RENEWABLE ENERGY DEVELOPMENT AGENCY', 50, 80);

  ctx.font = '18px sans-serif';
  ctx.fillText('GOVERNMENT NOTIFICATION NO. TNERC-2026/884', 50, 130);
  ctx.fillText('Date of Notification: 12 March 2026', 50, 160);

  ctx.font = '16px sans-serif';
  ctx.fillText('Clause 1: Rooftop Solar Subsidy Guidelines', 50, 220);
  ctx.fillText('The state government hereby approves a subsidy of Rs. 45,000 per household', 50, 250);
  ctx.fillText('for domestic consumers installing 3kW to 5kW solar rooftop arrays.', 50, 280);

  ctx.font = '16px sans-serif';
  ctx.fillText('Clause 2: Application Submission Deadline', 50, 340);
  ctx.fillText('All applications must be submitted by 30 October 2026.', 50, 370);
  ctx.fillText('The annual household income limit to qualify is Rs. 3,50,000 per annum.', 50, 400);

  const pngBuffer = canvas.toBuffer('image/png');
  const pdfDoc = await PDFDocument.create();
  const pngImage = await pdfDoc.embedPng(pngBuffer);
  const page = pdfDoc.addPage([800, 1000]);
  page.drawImage(pngImage, { x: 0, y: 0, width: 800, height: 1000 });

  const pdfBytes = await pdfDoc.save();
  return Buffer.from(pdfBytes);
}

async function run() {
  const pdfBuffer = await createScannedPdfWithImage();
  const base64Pdf = pdfBuffer.toString('base64');
  const filename = `Genuine_Scanned_Circular_${Date.now()}.pdf`;

  console.log(`\n=== Testing Process Endpoint on localhost:3000 with ${filename} ===`);
  const processRes = await fetch('http://localhost:3000/api/documents/process', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      filename,
      fileData: base64Pdf,
      language: 'English',
    }),
  });

  console.log('Process HTTP Status:', processRes.status);
  const processData = await processRes.json();
  console.log('Process Response Summary:', {
    provider: processData.provider,
    pageCount: processData.pageCount,
    extractedPages: processData.pages?.length,
    firstPagePreview: processData.pages?.[0]?.extractedText?.slice(0, 120),
    error: processData.error,
  });

  if (!processRes.ok || !processData.pages || processData.pages.length === 0) {
    console.error('Failed to extract text from scanned PDF:', processData);
    process.exit(1);
  }

  console.log('\n=== Testing Ask Documents Endpoint on localhost:3000 with Extracted Scanned Pages ===');
  const askRes = await fetch('http://localhost:3000/api/documents/ask', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      documentId: 'scanned-doc-test',
      questionText: 'What is the approved rooftop solar subsidy amount and income limit?',
      pages: processData.pages,
    }),
  });

  console.log('Ask HTTP Status:', askRes.status);
  const askData = await askRes.json();
  console.log('Ask Answer:', askData.answerText);
  console.log('Ask Citations:', askData.citations);
  console.log('Execution Engine:', askData.executionEngine);
}

run();
