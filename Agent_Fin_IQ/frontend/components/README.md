# Components

Shared, reusable UI widgets used across multiple pages.

## Component List

| Component | Used By | Purpose |
|-----------|---------|---------|
| `StatusBadge.tsx` | InvoiceHub, DetailView, APMonitor | Color-coded status pill |
| `ConfidenceBar.tsx` | InvoiceHub, DetailView | AI confidence score visual |
| `ProcessingPipeline.tsx` | DetailView | Pipeline stage timeline |
| `SectionHeader.tsx` | All pages | Consistent section titles |
| `DateRangeFilter.tsx` | AuditTrail, Reports | Date picker filter |
| `Dropdown.tsx` | Multiple | Reusable dropdown menu |
| `Sidebar.tsx` | Root layout | Navigation sidebar |
| `Topbar.tsx` | Root layout | Top navigation bar |

## Conventions

- All components are **functional** (no class components)
- All components use **TypeScript** with typed props
- Styling uses **vanilla CSS** classes
