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
// POST /tally/ledgers
// Fetches Ledger masters from Tally and returns
// a normalized JSON array
// ──────────────────────────────────────────────
app.post('/tally/ledgers', requireApiKey, async (req, res) => {
  const ledgerXml = `<ENVELOPE>
  <HEADER>
    <VERSION>1</VERSION>
    <TALLYREQUEST>EXPORT</TALLYREQUEST>
    <TYPE>COLLECTION</TYPE>
    <ID>Ledger Collection</ID>
  </HEADER>
  <BODY>
    <DESC>
      <STATICVARIABLES>
        <SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>
      </STATICVARIABLES>
      <TDL>
        <TDLMESSAGE>
          <COLLECTION NAME="Ledger Collection" ISINITIALIZE="Yes">
            <TYPE>Ledger</TYPE>
            <FETCH>
              NAME,
              MASTERID,
              GUID,
              PARENT,
              GSTREGISTRATIONTYPE,
              PARTYGSTIN,
              INCOMETAXNUMBER,
              LEDGERPHONE,
              EMAIL,
              ADDRESS,
              COUNTRYNAME,
              LEDGERSTATENAME,
              PINCODE,
              ISBILLWISEON
            </FETCH>
          </COLLECTION>
        </TDLMESSAGE>
      </TDL>
    </DESC>
  </BODY>
</ENVELOPE>`;

  // ── local helpers (do not affect PO route) ──

  function lGetValue(v) {
    if (v === null || v === undefined) return null;
    if (typeof v === 'object') {
      if (Object.prototype.hasOwnProperty.call(v, '#text')) return String(v['#text']);
      return null;
    }
    return v;
  }

  function lToStr(v) {
    const raw = lGetValue(v);
    if (raw === null || raw === undefined) return null;
    const s = String(raw).trim();
    return s === '' ? null : s;
  }

  function lToArray(val) {
    if (!val) return [];
    return Array.isArray(val) ? val : [val];
  }

  // Resolve name: prefer @_NAME attr, fall back to nested LANGUAGENAME path
  function resolveName(ledger) {
    const attrName = lToStr(ledger['@_NAME']);
    if (attrName) return attrName;
    try {
      const nested = ledger['LANGUAGENAME']['LIST']['NAME']['LIST']['NAME'];
      return lToStr(nested) || lToStr(lToArray(nested)[0]);
    } catch (_) {
      return null;
    }
  }

  function deriveAccountType(parentGroup) {
    if (!parentGroup) return 'expense';
    const pg = parentGroup.toLowerCase();
    if (pg.includes('creditor')) return 'liability';
    if (pg.includes('debtor')) return 'asset';
    if (pg.includes('cash')) return 'asset';
    if (pg.includes('bank')) return 'asset';
    if (pg.includes('tax')) return 'tax';
    if (pg.includes('duties')) return 'tax';
    if (pg.includes('expense')) return 'expense';
    if (pg.includes('purchase')) return 'expense';
    return 'expense';
  }

  try {
    const tallyResponse = await axios.post(TALLY_URL, ledgerXml, {
      headers: { 'Content-Type': 'text/xml' },
      timeout: 30000,
    });

    const parsed = xmlParser.parse(tallyResponse.data);

    const rawLedger = parsed?.ENVELOPE?.BODY?.DATA?.COLLECTION?.LEDGER;
    const ledgers = lToArray(rawLedger);

    const mappedRecords = ledgers.map((l) => {
      const erp_sync_id = lToStr(l.MASTERID) || lToStr(l['@_MASTERID']);
      const name = resolveName(l);
      const parent_group = lToStr(l.PARENT) || null;
      const ledger_code = null;
      const is_active = true;

      const guid = lToStr(l.GUID) || null;
      const gst_registration_type = lToStr(l.GSTREGISTRATIONTYPE) || null;
      const party_gstin = lToStr(l.PARTYGSTIN) || null;
      const income_tax_number = lToStr(l.INCOMETAXNUMBER) || null;
      const is_billwise_on = lToStr(l.ISBILLWISEON) || null;

      const gst_details = {
        guid,
        gst_registration_type,
        party_gstin,
        income_tax_number,
        is_billwise_on,
      };

      const account_type = deriveAccountType(parent_group);


      return {
        ledger_code,
        name,
        account_type,
        erp_sync_id,
        parent_group,
        is_active,
        gst_details,
        raw_payload: l,
      };
    });

    const records = mappedRecords.filter((r) => r.erp_sync_id && r.name);

    return res.json({
      success: true,
      entity_type: 'ledgers',
      count: records.length,
      records: records,
      fetched_at: new Date().toISOString(),
    });

  } catch (err) {
    console.error('[tally/ledgers] Error:', err.message);
    return res.status(502).json({
      success: false,
      error: 'Failed to fetch ledgers from Tally',
      details: err.message,
    });
  }
});

// ──────────────────────────────────────────────
// POST /tally/companies
// Fetches Company master from Tally and returns
// a normalized JSON array
// ──────────────────────────────────────────────
app.post('/tally/companies', requireApiKey, async (req, res) => {
  const companyXml = `<ENVELOPE>
  <HEADER>
    <VERSION>1</VERSION>
    <TALLYREQUEST>EXPORT</TALLYREQUEST>
    <TYPE>COLLECTION</TYPE>
    <ID>Company Master</ID>
  </HEADER>
  <BODY>
    <DESC>
      <STATICVARIABLES>
        <SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>
      </STATICVARIABLES>
      <TDL>
        <TDLMESSAGE>
          <COLLECTION NAME="Company Master" ISINITIALIZE="Yes">
            <TYPE>Company</TYPE>
            <FETCH>
              NAME,
              GUID,
              MAILINGNAME,
              ADDRESS,
              STATENAME,
              PINCODE,
              PHONENUMBER,
              EMAIL,
              WEBSITE,
              INCOMETAXNUMBER,
              TAXREGISTRATIONNUMBER,
              CINREGISTRATIONNUMBER,
              TANNUM,
              BOOKSBEGINNINGFROM,
              STARTINGFROM,
              BASECURRENCYNAME,
              LICENSEKEY,
              SERIALNUMBER
            </FETCH>
          </COLLECTION>
        </TDLMESSAGE>
      </TDL>
    </DESC>
  </BODY>
</ENVELOPE>`;

  // ── local helpers (do not affect PO or ledger routes) ──

  function cGetValue(v) {
    if (v === null || v === undefined) return null;
    if (typeof v === 'object') {
      if (Object.prototype.hasOwnProperty.call(v, '#text')) return String(v['#text']);
      return null;
    }
    return v;
  }

  function cToStr(v) {
    const raw = cGetValue(v);
    if (raw === null || raw === undefined) return null;
    const s = String(raw).trim();
    return s === '' ? null : s;
  }

  function cToArray(val) {
    if (!val) return [];
    return Array.isArray(val) ? val : [val];
  }

  // Flatten address lines into a single string
  function cExtractAddress(addrField) {
    if (!addrField) return null;
    if (typeof addrField === 'string') {
      const s = addrField.trim();
      return s === '' ? null : s;
    }
    if (Array.isArray(addrField)) {
      const parts = addrField.map(cGetValue).filter(v => v !== null && v !== '');
      return parts.length > 0 ? parts.join(', ') : null;
    }
    if (typeof addrField === 'object') {
      // shape: { ADDRESS: ... } or { #text: ... }
      const inner = addrField['ADDRESS'] ?? addrField['#text'];
      if (inner !== undefined) {
        if (Array.isArray(inner)) {
          const parts = inner.map(cGetValue).filter(v => v !== null && v !== '');
          return parts.length > 0 ? parts.join(', ') : null;
        }
        return cToStr(inner);
      }
      return null;
    }
    return null;
  }

  // Parse Tally BOOKSBEGINNINGFROM (YYYYMMDD) → ISO date string
  function cParseTallyDate(v) {
    const s = cToStr(v);
    if (!s) return null;
    if (/^\d{8}$/.test(s)) return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
    return s;
  }

  // Derive fy_start month name from STARTINGFROM (e.g. "1-April-2024" → "april")
  function cDeriveFyStart(v) {
    const s = cToStr(v);
    if (!s) return 'april';
    const months = ['january','february','march','april','may','june','july','august','september','october','november','december'];
    const lower = s.toLowerCase();
    const found = months.find(m => lower.includes(m));
    return found || 'april';
  }

  // Parse TALLY_URL to extract port
  function cDerivePort(url) {
    try {
      const u = new URL(url);
      return u.port ? parseInt(u.port, 10) : 9000;
    } catch (_) {
      return 9000;
    }
  }

  try {
    const tallyResponse = await axios.post(TALLY_URL, companyXml, {
      headers: { 'Content-Type': 'text/xml' },
      timeout: 30000,
    });

    const parsed = xmlParser.parse(tallyResponse.data);

    // TDL collection path: ENVELOPE.BODY.DATA.COLLECTION.COMPANY
    // Also try direct BODY.DATA.COMPANY as fallback
    const bodyData = parsed?.ENVELOPE?.BODY?.DATA ?? {};
    const collection = bodyData?.COLLECTION ?? {};

    let rawCompanies =
      collection?.COMPANY ??           // primary: TDL collection result
      bodyData?.COMPANY   ??           // fallback 1: direct under DATA
      parsed?.ENVELOPE?.BODY?.DATA?.['COMPANY MASTER']?.COMPANY ?? // fallback 2
      null;

    console.log('[tally/companies] raw keys in DATA:', Object.keys(bodyData));
    console.log('[tally/companies] raw keys in COLLECTION:', Object.keys(collection));

    // Single object → wrap in array
    if (rawCompanies && !Array.isArray(rawCompanies)) {
      rawCompanies = [rawCompanies];
    }

    const companies = cToArray(rawCompanies);

    const mappedRecords = companies.map((c) => {
      // erp_sync_id: prefer GUID (most stable), fallback to name
      const guid   = cToStr(c.GUID) || null;
      const name   = cToStr(c.NAME) || cToStr(c['@_NAME']) || null;
      const erp_sync_id = guid || name;

      const trade_name = null; // MAILINGNAME does not reliably hold trade name in Tally

      // address
      const address = cExtractAddress(c['ADDRESS.LIST'] ?? c.ADDRESS) || null;
      const state   = cToStr(c.STATENAME) || null;
      const pincode = cToStr(c.PINCODE)   || null;
      const phone   = cToStr(c.PHONENUMBER) || null;
      const email   = cToStr(c.EMAIL)     || null;
      const website = cToStr(c.WEBSITE)   || null;

      // tax identifiers
      const pan    = cToStr(c.INCOMETAXNUMBER)       || null;
      const gstin  = cToStr(c.TAXREGISTRATIONNUMBER) || null;
      const cin    = cToStr(c.CINREGISTRATIONNUMBER) || null;
      const tan    = cToStr(c.TANNUM)                || null;

      // fiscal settings
      const fy_start    = cDeriveFyStart(c.STARTINGFROM);
      const currency    = cToStr(c.BASECURRENCYNAME) || 'INR';
      const books_from  = cParseTallyDate(c.STARTINGFROM) || cParseTallyDate(c.BOOKSBEGINNINGFROM) || null;

      // tally metadata
      const tally_company_name    = name;
      const tally_license_serial  = cToStr(c.SERIALNUMBER) || cToStr(c.LICENSEKEY) || null;
      const tally_version         = null; // not exposed in standard company object export

      const integration_params = {
        tally_server_url: TALLY_URL,
        tally_port: cDerivePort(TALLY_URL),
      };

      return {
        name,
        trade_name,
        type: 'pvt_ltd',
        gstin,
        tax_id: null,
        pan,
        cin,
        tan,
        address,
        city: null,
        state,
        pincode,
        phone,
        email,
        website,
        fy_start,
        currency,
        books_from,
        erp_sync_id,
        tally_company_name,
        tally_license_serial,
        tally_version,
        integration_params,
        raw_payload: c,
      };
    });

    const records = mappedRecords.filter((r) => r.erp_sync_id && r.name);

    return res.json({
      success: true,
      entity_type: 'companies',
      count: records.length,
      records: records,
      fetched_at: new Date().toISOString(),
    });

  } catch (err) {
    console.error('[tally/companies] Error:', err.message);
    return res.status(502).json({
      success: false,
      error: 'Failed to fetch company from Tally',
      details: err.message,
    });
  }
});

// ──────────────────────────────────────────────
// POST /tally/stock-items
// Fetches Stock Item masters from Tally and returns
// a normalized JSON array
// ──────────────────────────────────────────────
app.post('/tally/stock-items', requireApiKey, async (req, res) => {
  const stockItemXml = `<ENVELOPE>
  <HEADER>
    <VERSION>1</VERSION>
    <TALLYREQUEST>EXPORT</TALLYREQUEST>
    <TYPE>COLLECTION</TYPE>
    <ID>Stock Item Collection</ID>
  </HEADER>
  <BODY>
    <DESC>
      <STATICVARIABLES>
        <SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>
      </STATICVARIABLES>
      <TDL>
        <TDLMESSAGE>
          <COLLECTION NAME="Stock Item Collection" ISINITIALIZE="Yes">
            <TYPE>StockItem</TYPE>
            <FETCH>
              MASTERID,
              GUID,
              NAME,
              BASEUNITS,
              PARTNUMBER,
              HSNCODE,
              OPENINGRATE,
              GSTRATEDETAILS
            </FETCH>
          </COLLECTION>
        </TDLMESSAGE>
      </TDL>
    </DESC>
  </BODY>
</ENVELOPE>`;

  // ── local helpers (do not affect other routes) ──

  function sGetValue(v) {
    if (v === null || v === undefined) return null;
    if (typeof v === 'object') {
      if (Object.prototype.hasOwnProperty.call(v, '#text')) return String(v['#text']);
      return null;
    }
    return v;
  }

  function sToStr(v) {
    const raw = sGetValue(v);
    if (raw === null || raw === undefined) return null;
    const s = String(raw).trim();
    return s === '' ? null : s;
  }

  function sToArray(val) {
    if (!val) return [];
    return Array.isArray(val) ? val : [val];
  }

  function sToNumber(val) {
    const raw = sGetValue(val);
    if (raw === null || raw === undefined || raw === '') return null;
    const n = parseFloat(raw.toString().replace(/[^\d.-]/g, ''));
    return isNaN(n) ? null : n;
  }

  try {
    const tallyResponse = await axios.post(TALLY_URL, stockItemXml, {
      headers: { 'Content-Type': 'text/xml' },
      timeout: 30000,
    });

    const parsed = xmlParser.parse(tallyResponse.data);

    const rawStockItems = parsed?.ENVELOPE?.BODY?.DATA?.COLLECTION?.STOCKITEM;
    const stockItems = sToArray(rawStockItems);

    const mappedRecords = stockItems.map((item) => {
      const erp_sync_id = sToStr(item.MASTERID) || sToStr(item.GUID) || sToStr(item['@_MASTERID']);
      const item_name = sToStr(item.NAME) || sToStr(item['@_NAME']);
      const item_code = sToStr(item.PARTNUMBER) || null;
      const hsn_sac = sToStr(item.HSNCODE) || null;
      const uom = sToStr(item.BASEUNITS) || null;
      const base_price = sToNumber(item.OPENINGRATE);
      
      let tax_rate = null;
      try {
        const gstDetails = sToArray(item.GSTRATEDETAILS?.['GSTRATE.LIST']);
        if (gstDetails.length > 0) {
          const rateInfo = gstDetails[0];
          tax_rate = sToNumber(rateInfo?.GSTRATE);
        }
      } catch (_) {}

      return {
        item_name,
        item_code,
        hsn_sac,
        uom,
        base_price,
        tax_rate,
        erp_sync_id,
        raw_payload: item,
      };
    });

    const records = mappedRecords.filter((r) => {
      if (!r.item_name || !r.erp_sync_id) return false;
      const cleanName = r.item_name.trim().toLowerCase();
      if (cleanName === '' || cleanName === 'null') return false;
      return true;
    });

    return res.json({
      success: true,
      entity_type: 'stock_items',
      count: records.length,
      records: records,
      fetched_at: new Date().toISOString(),
    });

  } catch (err) {
    console.error('[tally/stock-items] Error:', err.message);
    return res.status(502).json({
      success: false,
      error: 'Failed to fetch stock items from Tally',
      details: err.message,
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