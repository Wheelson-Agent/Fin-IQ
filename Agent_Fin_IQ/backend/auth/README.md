# Auth Module

Role-based authentication for agent_ai_tally.

## Files

| File | Purpose |
|------|---------|
| `auth.ts` | Login, password hashing (PBKDF2), session token generation |
| `roles.ts` | Role definitions and permission checks |

## Roles

| Role | Upload | Approve | Config | Users |
|------|--------|---------|--------|-------|
| `admin` | ✅ | ✅ | ✅ | ✅ |
| `approver` | ✅ | ✅ | ❌ | ❌ |
| `operator` | ✅ | ❌ | ❌ | ❌ |
| `viewer` | ❌ | ❌ | ❌ | ❌ |

## Security

- Passwords hashed with PBKDF2 (100,000 iterations, SHA-512)
- Session tokens valid for 24 hours (configurable)
- Inactive accounts are blocked from login
