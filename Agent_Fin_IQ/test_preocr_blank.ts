import { runFullPipeline } from './backend/pre-ocr/engine.ts';
import fs from 'fs';
import path from 'path';
import sharp from 'sharp';

async function test() {
    try {
        const blankBuffer = await sharp({
            create: {
                width: 1000,
                height: 1000,
                channels: 3,
                background: { r: 255, g: 255, b: 255 }
            }
        }).png().toBuffer();

        console.log('--- Testing Blank Image ---');
        const result = await runFullPipeline(blankBuffer, 'blank_test.png');
        console.log('Result:', JSON.stringify(result.decision, null, 2));
        console.log('Job Status:', result.job.status);
        console.log('Reasons:', result.decision.reasons);
    } catch (err) {
        console.error('Test failed:', err);
    }
}

test();
