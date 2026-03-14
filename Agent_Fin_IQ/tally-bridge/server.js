require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const axios = require('axios');
const { XMLParser } = require('fast-xml-parser');

const app = express();
const PORT = process.env.PORT || 7070;
const TALLY_URL = process.env.TALLY_URL || 'http://localhost:9000';
const BRIDGE_API_KEY = process.env.BRIDGE_API_KEY;

// ──────────────────────────────────────────────
// Middleware
// ──────────────────────────────────────────────
app.use(helmet());
app.use(cors());
app.use(morgan('dev'));
app.use(express.json());
app.use(express.text({ type: 'text/xml' }));

// ──────────────────────────────────────────────
// API Key Auth Middleware
// ──────────────────────────────────────────────
function requireApiKey(req, res, next) {
  const key = req.headers['x-api-key'];
  if (!BRIDGE_API_KEY || key !== BRIDGE_API_KEY) {
    return res.status(401).json({ error: 'Unauthorized: invalid or missing API key' });
  }
  next();
}

// ──────────────────────────────────────────────
// XML Parser
// ──────────────────────────────────────────────
const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  parseAttributeValue: true,
});

// ──────────────────────────────────────────────
// Health Check
// ──────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ──────────────────────────────────────────────
// POST /tally/query
// Body: { xml: '<ENVELOPE>...</ENVELOPE>' }
// Forwards raw XML to Tally and returns parsed JSON
// ──────────────────────────────────────────────
app.post('/tally/query', requireApiKey, async (req, res) => {
  try {
    const xmlPayload = req.body?.xml || req.body;

    if (!xmlPayload || typeof xmlPayload !== 'string') {
      return res.status(400).json({ error: 'Request body must contain an XML string (field: xml)' });
    }

    const tallyResponse = await axios.post(TALLY_URL, xmlPayload, {
      headers: { 'Content-Type': 'text/xml' },
      timeout: 15000,
    });

    const parsed = xmlParser.parse(tallyResponse.data);
    return res.json({ success: true, data: parsed });
  } catch (err) {
    console.error('[tally/query] Error:', err.message);
    return res.status(502).json({
      error: 'Failed to reach Tally',
      details: err.message,
    });
  }
});


// ──────────────────────────────────────────────
// POST /tally/purchase-orders
// Fetches Purchase Order vouchers from Tally and
// returns a normalized JSON array
// ──────────────────────────────────────────────
app.post('/tally/purchase-orders', requireApiKey, async (req, res) => {
  const poXml = `<ENVELOPE>
  <HEADER>
    <VERSION>1</VERSION>
    <TALLYREQUEST>EXPORT</TALLYREQUEST>
    <TYPE>COLLECTION</TYPE>
    <ID>PO Voucher Collection</ID>
  </HEADER>
  <BODY>
    <DESC>
      <STATICVARIABLES>
        <SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>
      </STATICVARIABLES>
      <TDL>
        <TDLMESSAGE>
          <SYSTEM TYPE="Formulae" NAME="IsPO">$$IsEqual:$VoucherTypeName:"Purchase Order"</SYSTEM>
          <COLLECTION NAME="PO Voucher Collection" ISINITIALIZE="Yes">
            <TYPE>Voucher</TYPE>
            <FETCH>Date, VoucherNumber, Reference, VoucherTypeName, MasterID, AlterID, GUID, LedgerEntries</FETCH>
            <FILTER>IsPO</FILTER>
          </COLLECTION>
        </TDLMESSAGE>
      </TDL>
    </DESC>
  </BODY>
</ENVELOPE>`;

  function getValue(v) {
    if (v === null || v === undefined) return null;
    if (typeof v === 'object') {
      if (Object.prototype.hasOwnProperty.call(v, '#text')) return v['#text'];
      return null;
    }
    return v;
  }

  function tallyDateToISO(val) {
    const raw = getValue(val);
    const s = raw === null || raw === undefined ? '' : String(raw).trim();
    if (!/^\d{8}$/.test(s)) return null;
    return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
  }

  function toNumber(val) {
    const raw = getValue(val);
    if (raw === null || raw === undefined || raw === '') return 0;
    const n = Number(raw);
    return Number.isFinite(n) ? n : 0;
  }

  function toArray(val) {
    if (!val) return [];
    return Array.isArray(val) ? val : [val];
  }

  try {
    const tallyResponse = await axios.post(TALLY_URL, poXml, {
      headers: { 'Content-Type': 'text/xml' },
      timeout: 30000,
    });

    const parsed = xmlParser.parse(tallyResponse.data);

    const rawVoucher = parsed?.ENVELOPE?.BODY?.DATA?.COLLECTION?.VOUCHER;
    const vouchers = toArray(rawVoucher);

    const mappedRecords = vouchers.map((v) => {
      const ledgerEntries = toArray(v['LEDGERENTRIES.LIST']);

      const partyLedger = ledgerEntries.find(
        (entry) => String(getValue(entry?.ISPARTYLEDGER) ?? entry?.ISPARTYLEDGER ?? '').trim().toLowerCase() === 'yes'
      );

      const totalAmount = Math.abs(toNumber(partyLedger?.AMOUNT));

      const po_number = String(getValue(v.VOUCHERNUMBER) ?? '').trim();
      const po_date = tallyDateToISO(v.DATE);
      const erp_sync_id = String(getValue(v.MASTERID) ?? '').trim();

      const status = 'Open';
      const source_hash = `${po_number}|${po_date}|${totalAmount}|${erp_sync_id}|${status}`;
      const raw_payload = v;

      return {
        po_number,
        po_date,
        total_amount: totalAmount,
        status,
        erp_sync_id,
        source_hash,
        raw_payload,
      };
    });

    const records = mappedRecords.filter((r) => r.po_number && r.po_date && r.erp_sync_id);

    return res.json({
      success: true,
      entity_type: "purchase_orders",
      count: records.length,
      records: records,
      fetched_at: new Date().toISOString()
    });

  } catch (err) {
    return res.status(500).json({
      success: false,
      error: "Failed to fetch purchase orders from Tally",
      details: err.message
    });
  }
});

// ──────────────────────────────────────────────
// 404 Handler
// ──────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ error: `Route ${req.method} ${req.path} not found` });
});

// ──────────────────────────────────────────────
// Start Server
// ──────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`✅ Tally Bridge running on http://localhost:${PORT}`);
  console.log(`   → Forwarding requests to Tally at: ${TALLY_URL}`);
});