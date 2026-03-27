import { runFullPipeline } from '../backend/pre-ocr/engine.ts';
import { PRE_OCR_STAGES } from '../backend/pre-ocr/types.ts';

/**
 * Pre-OCR stages (in order):
 * 1) Upload / Ingestion
 * 2) File Validation
 * 3) Image Extraction & Normalization
 * 4) Image Quality Assessment
 * 5) Image Enhancement
 * 6) Structural Analysis
 * 7) Decision Engine
 */

async function makePngBuffer(): Promise<Buffer> {
  const sharp = (await import('sharp')).default;

  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="1240" height="1754">
      <rect width="100%" height="100%" fill="white"/>
      <text x="80" y="140" font-size="56" font-family="Arial" fill="black">PRE-OCR SMOKE TEST</text>
      <text x="80" y="230" font-size="40" font-family="Arial" fill="black">Invoice No: INV-001</text>
      <text x="80" y="290" font-size="40" font-family="Arial" fill="black">Total: 12345.67</text>
      <line x1="80" y1="340" x2="1160" y2="340" stroke="black" stroke-width="3"/>
      <rect x="80" y="400" width="1080" height="900" fill="none" stroke="black" stroke-width="3"/>
      <text x="100" y="470" font-size="32" font-family="Arial" fill="black">Item</text>
      <text x="700" y="470" font-size="32" font-family="Arial" fill="black">Amount</text>
      <text x="100" y="540" font-size="28" font-family="Arial" fill="black">Service A</text>
      <text x="700" y="540" font-size="28" font-family="Arial" fill="black">1000.00</text>
      <text x="100" y="610" font-size="28" font-family="Arial" fill="black">Service B</text>
      <text x="700" y="610" font-size="28" font-family="Arial" fill="black">2000.00</text>
    </svg>
  `.trim();

  return await sharp(Buffer.from(svg)).png().toBuffer();
}

async function makeDenseInvoicePngBuffer(): Promise<Buffer> {
  const sharp = (await import('sharp')).default;

  const rows = Array.from({ length: 12 }, (_, index) => {
    const y = 430 + index * 65;
    const amount = (17000 - index * 850).toFixed(2);
    return `
      <text x="84" y="${y}" font-size="24" font-family="Arial" fill="black">${index + 1}</text>
      <text x="130" y="${y}" font-size="24" font-family="Arial" fill="black">Item ${index + 1} Description</text>
      <text x="860" y="${y}" font-size="24" font-family="Arial" fill="black">${amount}</text>
    `;
  }).join('\n');

  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="1240" height="1754">
      <rect width="100%" height="100%" fill="white"/>
      <text x="500" y="90" font-size="40" font-family="Arial" fill="black">TAX INVOICE</text>
      <text x="70" y="145" font-size="22" font-family="Arial" fill="black">Vendor: VRP MARKETING</text>
      <text x="70" y="180" font-size="22" font-family="Arial" fill="black">Invoice No: 1418/2024-25</text>
      <text x="70" y="215" font-size="22" font-family="Arial" fill="black">Invoice Date: 03-01-2025</text>
      <text x="70" y="250" font-size="22" font-family="Arial" fill="black">Buyer: EPPINGER TOOLS ASIA PVT LTD</text>
      <rect x="70" y="300" width="1100" height="1050" fill="none" stroke="black" stroke-width="3"/>
      <line x1="120" y1="300" x2="120" y2="1350" stroke="black" stroke-width="2"/>
      <line x1="820" y1="300" x2="820" y2="1350" stroke="black" stroke-width="2"/>
      <line x1="70" y1="380" x2="1170" y2="380" stroke="black" stroke-width="2"/>
      <text x="84" y="350" font-size="24" font-family="Arial" fill="black">Sl</text>
      <text x="160" y="350" font-size="24" font-family="Arial" fill="black">Description</text>
      <text x="890" y="350" font-size="24" font-family="Arial" fill="black">Amount</text>
      ${rows}
      <rect x="760" y="1120" width="250" height="120" fill="none" stroke="#b91c1c" stroke-width="5" transform="rotate(-8 760 1120)"/>
      <text x="785" y="1175" font-size="42" font-family="Arial" fill="#b91c1c" transform="rotate(-8 785 1175)">ETA</text>
      <text x="785" y="1215" font-size="28" font-family="Arial" fill="#b91c1c" transform="rotate(-8 785 1215)">MIN NO. 119223</text>
      <text x="70" y="1445" font-size="26" font-family="Arial" fill="black">Tax Amount (in words): INR Twenty One Thousand Three Hundred Seventy Two and Forty Eight paisa Only</text>
      <text x="70" y="1505" font-size="24" font-family="Arial" fill="black">Declaration: We are not responsible for any loss/damage in transit.</text>
      <text x="70" y="1570" font-size="24" font-family="Arial" fill="black">Authorized Signatory</text>
    </svg>
  `.trim();

  return await sharp(Buffer.from(svg)).png().toBuffer();
}

async function makePdfBuffer(): Promise<Buffer> {
  const { PDFDocument, StandardFonts, rgb } = await import('pdf-lib');

  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([595.28, 841.89]); // A4 points
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

  page.drawText('PRE-OCR SMOKE TEST', { x: 48, y: 780, size: 22, font, color: rgb(0, 0, 0) });
  page.drawText('Invoice No: INV-001', { x: 48, y: 740, size: 14, font, color: rgb(0, 0, 0) });
  page.drawText('Total: 12345.67', { x: 48, y: 715, size: 14, font, color: rgb(0, 0, 0) });
  page.drawRectangle({ x: 48, y: 120, width: 500, height: 560, borderColor: rgb(0, 0, 0), borderWidth: 1 });

  const bytes = await pdfDoc.save();
  return Buffer.from(bytes);
}

async function makeTextHeavyPdfBuffer(): Promise<Buffer> {
  const { PDFDocument, StandardFonts, rgb } = await import('pdf-lib');

  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([595.28, 841.89]); // A4 points
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

  page.drawText('TEXT HEAVY PDF (FAST ROUTE SHOULD TRIGGER)', { x: 48, y: 800, size: 14, font, color: rgb(0, 0, 0) });
  let y = 770;
  for (let i = 1; i <= 80; i++) {
    page.drawText(`Line ${String(i).padStart(3, '0')}: The quick brown fox jumps over the lazy dog ${i}`, { x: 48, y, size: 10, font, color: rgb(0, 0, 0) });
    y -= 9;
    if (y < 60) break;
  }

  const bytes = await pdfDoc.save();
  return Buffer.from(bytes);
}

function printSummary(label: string, result: Awaited<ReturnType<typeof runFullPipeline>>) {
  const s2 = result.job.stages['File Validation'];
  const s3 = result.job.stages['Image Extraction & Normalization'];
  const s4 = result.job.stages['Image Quality Assessment'];
  const s5 = result.job.stages['Image Enhancement'];

  console.log(`\n=== ${label} ===`);
  console.log('jobId:', result.jobId);
  console.log('decision:', result.decision);
  console.log('s2:', { status: s2.status, reasonCodes: s2.reasonCodes, pageCount: s2.metrics?.pageCount });
  console.log('s3:', { status: s3.status, rasterizer: s3.metrics?.rasterizer, pageCount: s3.metrics?.pageCount, error: s3.metrics?.error });
  console.log('s4:', { status: s4.status, totalPages: s4.metrics?.totalPages, blurryPages: s4.metrics?.blurryPages, blankPages: s4.metrics?.blankPages });
  console.log('s5:', { status: s5.status, enhancedPages: s5.metrics?.enhancedPages, orientationApplied: s5.metrics?.orientationApplied });
}

async function main() {
  console.log('Pre-OCR stages:', PRE_OCR_STAGES.join(' -> '));

  const png = await makePngBuffer();
  const pngResult = await runFullPipeline(png, 'smoke.png');
  printSummary('PNG INPUT', pngResult);

  const sharp = (await import('sharp')).default;
  const pngRot90 = await sharp(png).rotate(90, { background: { r: 255, g: 255, b: 255, alpha: 1 } }).png().toBuffer();
  const pngRotResult = await runFullPipeline(pngRot90, 'smoke_rot90.png');
  printSummary('PNG ROTATED 90', pngRotResult);

  const pdf = await makePdfBuffer();
  const pdfResult = await runFullPipeline(pdf, 'smoke.pdf');
  printSummary('PDF INPUT', pdfResult);

  const textPdf = await makeTextHeavyPdfBuffer();
  const textPdfResult = await runFullPipeline(textPdf, 'text_only.pdf');
  printSummary('TEXT-ONLY PDF (FAST ROUTE)', textPdfResult);

  const denseInvoice = await makeDenseInvoicePngBuffer();
  const denseSkewed = await sharp(denseInvoice).rotate(5, { background: { r: 255, g: 255, b: 255, alpha: 1 } }).png().toBuffer();
  const denseSkewedResult = await runFullPipeline(denseSkewed, 'dense_skewed_upright.png');
  printSummary('DENSE SKEWED UPRIGHT PNG', denseSkewedResult);

  const denseOrientation = denseSkewedResult.job.stages['Image Enhancement']?.metrics?.orientationApplied?.angle;
  if (denseOrientation === 180) {
    console.error('[preocr_smoke] regression: upright skewed invoice was incorrectly rotated 180 degrees');
    process.exitCode = 1;
  }

  const failed = [pngResult, pngRotResult, pdfResult, textPdfResult, denseSkewedResult].some((r) => r.decision.route === 'FAILED');
  if (failed) process.exitCode = 1;
}

main().catch((err) => {
  console.error('[preocr_smoke] fatal:', err);
  process.exitCode = 1;
});
