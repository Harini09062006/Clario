import http from 'http';
import handler from '../api/index.js';

async function run() {
  const server = http.createServer((req, res) => {
    handler(req, res);
  });

  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  const port = address.port;
  const baseUrl = `http://127.0.0.1:${port}`;
  console.log(`[Test Serverless Handler] Listening on ${baseUrl}`);

  try {
    // 1. Test GET /api/status
    console.log('\n--- Test 1: GET /api/status ---');
    const resStatus = await fetch(`${baseUrl}/api/status`);
    console.log('Status code:', resStatus.status);
    const bodyStatus = await resStatus.json();
    console.log('Status body:', JSON.stringify(bodyStatus, null, 2));
    if (resStatus.status !== 200 || bodyStatus.status !== 'online') {
      throw new Error('/api/status did not return 200 online');
    }

    // 2. Test GET /api
    console.log('\n--- Test 2: GET /api ---');
    const resApi = await fetch(`${baseUrl}/api`);
    console.log('Status code:', resApi.status);
    const bodyApi = await resApi.json();
    console.log('Body:', bodyApi);
    if (resApi.status !== 200 || bodyApi.status !== 'online') {
      throw new Error('/api did not return 200 online');
    }

    // 3. Test POST /api/documents/process with invalid data
    console.log('\n--- Test 3: POST /api/documents/process (invalid PDF) ---');
    const resInvalid = await fetch(`${baseUrl}/api/documents/process`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filename: 'bad.pdf', fileData: 'not-a-pdf' }),
    });
    console.log('Status code:', resInvalid.status);
    const bodyInvalid = await resInvalid.json();
    console.log('Body:', bodyInvalid);
    if (resInvalid.status !== 400 || bodyInvalid.code !== 'invalid_pdf_format') {
      throw new Error('/api/documents/process did not return 400 for invalid PDF');
    }

    // 4. Test POST /api/documents/process with a digital PDF generated using pdf-lib
    console.log('\n--- Test 4: POST /api/documents/process (valid digital PDF) ---');
    const { PDFDocument, rgb, StandardFonts } = await import('pdf-lib');
    const pdfDoc = await PDFDocument.create();
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const page = pdfDoc.addPage([600, 400]);
    page.drawText('Clario Government Scheme Verification Document 2026. Coverage Rs. 500000.', {
      x: 50,
      y: 350,
      size: 14,
      font,
      color: rgb(0, 0, 0),
    });
    const pdfBytes = await pdfDoc.save();
    const base64Pdf = Buffer.from(pdfBytes).toString('base64');

    const resProcess = await fetch(`${baseUrl}/api/documents/process`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        filename: 'test-scheme-2026.pdf',
        fileData: base64Pdf,
        language: 'English',
      }),
    });
    console.log('Process Status code:', resProcess.status);
    const bodyProcess = await resProcess.json();
    console.log('Process body summary:', bodyProcess.summary);
    console.log('Extracted page count:', bodyProcess.pages?.length);
    if (resProcess.status !== 200 || !bodyProcess.pages || bodyProcess.pages.length === 0) {
      throw new Error('Valid PDF processing did not succeed');
    }

    // 5. Test scanned PDF without OCR returns clear 503 ocr_unavailable
    console.log('\n--- Test 5: Scanned empty/image PDF without OCR returns structured 503 ---');
    // Create an empty image-like PDF with no text elements
    const emptyDoc = await PDFDocument.create();
    emptyDoc.addPage([400, 400]); // Blank page
    const emptyPdfBytes = await emptyDoc.save();
    const emptyBase64 = Buffer.from(emptyPdfBytes).toString('base64');

    const resScanned = await fetch(`${baseUrl}/api/documents/process`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        filename: 'blank-scan.pdf',
        fileData: emptyBase64,
        language: 'Tamil',
      }),
    });
    console.log('Scanned Doc Status code:', resScanned.status);
    const bodyScanned = await resScanned.json();
    console.log('Scanned Doc body:', bodyScanned);
    if (resScanned.status !== 503 || bodyScanned.code !== 'ocr_unavailable') {
      throw new Error('Expected 503 ocr_unavailable for scanned PDF with no OCR');
    }

    console.log('\n>>> ALL 5 SERVERLESS HANDLER VERIFICATION TESTS PASSED! <<<');
  } finally {
    server.close();
  }
}

run().catch((err) => {
  console.error('[Verification Error]', err);
  process.exit(1);
});
