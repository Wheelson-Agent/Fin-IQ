import puppeteer from 'puppeteer';

(async () => {
    console.log("Starting puppeteer tests after fix...");
    try {
        const browser = await puppeteer.launch();
        const page = await browser.newPage();

        page.on('console', msg => {
            if (msg.type() === 'error' || msg.type() === 'warning') {
                console.log(`PAGE MSG [${msg.type()}]:`, msg.text());
            }
        });
        page.on('pageerror', error => {
            console.log('PAGE UNCAUGHT ERROR:', error.message);
        });

        console.log("Navigating to http://localhost:5174/ (Dashboard)...");
        await page.goto('http://localhost:5174/', { waitUntil: 'networkidle0', timeout: 30000 });
        await page.screenshot({ path: 'app-dashboard.png' });
        console.log("Saved app-dashboard.png");

        console.log("Navigating to http://localhost:5174/invoices (InvoiceHub)...");
        await page.goto('http://localhost:5174/invoices', { waitUntil: 'networkidle0', timeout: 30000 });
        await page.screenshot({ path: 'app-invoices.png' });
        console.log("Saved app-invoices.png");

        await browser.close();
        console.log("Done.");
    } catch (e) {
        console.error("Puppeteer Script Error:", e);
    }
})();
