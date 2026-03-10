# Pages

Each file in this folder represents one UI page. **One page = one file**.

## Page List

| File | Route | Description |
|------|-------|-------------|
| `Dashboard.tsx` | `/` | Executive overview: KPIs, charts, pipeline funnel |
| `InvoiceHub.tsx` | `/invoices` | Upload files, filter, search, bulk actions |
| `DetailView.tsx` | `/detail/:id` | Single invoice verification, line items, approve/reject |
| `APMonitor.tsx` | `/payables` | Accounts payable: vendor aging, risk assessment |
| `AuditTrail.tsx` | `/audit` | Complete history of system actions |
| `PendingApprovalQueue.tsx` | (sub-view) | Invoices awaiting human approval |
| `FailedQueue.tsx` | (sub-view) | Invoices that failed processing |
| `Config.tsx` | `/config` | System settings (admin only) |
| `Login.tsx` | `/login` | User authentication page |
| `AgentPage.tsx` | `/agent` | AI agent monitoring dashboard |
| `Reports.tsx` | `/reports` | Export and analytics |
| `Vendors.tsx` | `/vendors` | Vendor master management |
| `UserProfile.tsx` | `/profile` | User settings and preferences |
| `NotFound.tsx` | `*` | 404 page |

## Data Source

All pages import data from `../lib/api.ts` (NOT mockData.ts).
```tsx
import { getInvoices } from '../lib/api';

export default function InvoiceHub() {
  const [invoices, setInvoices] = useState([]);
  useEffect(() => { getInvoices().then(setInvoices); }, []);
}
```
