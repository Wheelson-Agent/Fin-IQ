# User Management — How It Works

A practical guide to how user accounts, roles, and permissions work in Fin-IQ. Split into two parts:

- **Part A — For Admins:** creating users, setting approval limits, managing access
- **Part B — For Operators:** what your account lets you do, what's blocked, and why

---

## Part A — For Admins

### What is this system?

Fin-IQ has **two kinds of users**:

| Role | Who they are | What they can do |
|---|---|---|
| **Admin** | Finance lead / system owner | Everything. No restrictions anywhere. |
| **Operator** | AP team member who processes invoices day-to-day | Only what you explicitly allow, bounded by an approval cap |

Every action an operator takes is controlled by **two knobs**:
1. **Module-level permissions** — which parts of the app they can see and edit
2. **Approval limit** — the maximum invoice amount (in ₹) they're allowed to approve

Admins always have unrestricted access — the permission toggles don't apply to them.

---

### Getting to User Management

Sign in as an admin → click **User Management** in the sidebar (gear/settings section). Only admins see this link. If you don't see it, your account isn't an admin.

> 📸 *Screenshot: sidebar showing User Management entry for admin*

---

### The User Management page

Shows a table of every user in the system — active users first, then deactivated ones (grayed out).

Columns:
- **Name** — display name
- **Email** — login ID
- **Role** — Admin or Operator
- **Approval Limit** — the ₹ ceiling for invoice approvals (blank = no limit set)
- **Status** — Active / Deactivated
- **Actions** — Edit, Reset Password, Deactivate/Reactivate

Top-right: **+ Add User** button.

> 📸 *Screenshot: User Management page with table*

---

### Creating a new user

Click **+ Add User**. You'll see a dialog with these fields:

| Field | What to fill |
|---|---|
| **Email** | Their work email. This is their login ID. |
| **Display Name** | Name shown in the audit trail (e.g., "Priya Sharma") |
| **Password** | A temporary password. They'll be forced to change it on first login. |
| **Role** | Admin or Operator (see guidance below) |
| **Approval Limit** | ₹ amount they can approve on their own (Operators only). Blank = 0. |
| **Module Permissions** | Per-module access level (Operators only) |

Click **Create** to save.

> 📸 *Screenshot: Add User dialog*

#### When to pick Admin vs Operator

Pick **Admin** when:
- The person should approve invoices of any amount
- They need to change system configuration (posting rules, storage paths, extended criteria)
- They need to delete/restore invoices, waive PO requirements, manage other users
- They need access to Reports (cross-company financial summaries)

Pick **Operator** when:
- They process invoices day-to-day but approvals above a certain amount need a second set of eyes
- They should not change system configuration
- They should not see Reports
- They don't need to delete or waive anything

**Rule of thumb:** start as Operator. Promote to Admin only if you hit real friction.

---

### Approval Limits — deciding the right number

The approval limit is a **₹ ceiling on what an operator can move to "Approved" or "Auto-Posted"** on their own. If they try to approve an invoice above the limit, the system rejects it with an error telling them the number.

| Situation | Suggested limit |
|---|---|
| Trainee / new joiner | ₹10,000 – ₹25,000 |
| Experienced AP executive | ₹50,000 – ₹2,00,000 |
| Senior AP lead | ₹5,00,000+ |
| Operator you fully trust for routine invoices | Whatever covers 95% of typical invoices — you approve the rest |

**Leaving it blank** means they can approve **nothing** (the system treats blank as "no limit configured → block the operation"). Always set a number if you want the operator to approve anything at all.

**Changing the limit** takes effect immediately — no re-login needed.

---

### Module permissions — what each module means

For an Operator, you set each module to **None**, **View**, or **Edit**:

| Module | View means | Edit means |
|---|---|---|
| **Dashboard** | Can see KPIs, pipeline, Tally sync status, PO health | N/A (same as View) |
| **Invoices** | Can see the AP Workspace and invoice list | Can upload, edit, approve (bounded by limit), map vendors, revalidate |
| **PO** | Can see PO outstandings, GRNs, service entries | N/A |
| **Vendors** | Can see the vendor list | Can create/edit vendors, sync vendors to Tally |
| **Masters** | Can see ledgers, items, TDS sections | Can create new ledgers and stock items during invoice line-item entry |
| **Reports** | **Admin-only** — operators should stay None | — |
| **Audit** | Can read the audit trail | N/A (deleting audit rows is admin-only) |
| **Config** | Can view Control Hub / posting rules | **Admin-only for saving** — operators see a read-only banner even with Edit |
| **Users** | **Admin-only** — operators stay None | — |

> 📸 *Screenshot: module permission toggles in Edit User dialog*

**Even if you give an operator "Edit" on Config**, saving is still blocked server-side — it's admin-only. Same for deleting invoices, waiving PO requirements, and deleting audit rows. The permission grid controls the **day-to-day flow**; a handful of destructive/config actions are hardcoded admin-only for safety.

#### Default operator permissions (applied when you create a new operator without customizing)

- Dashboard: View
- Invoices: Edit
- PO: View
- Vendors: Edit
- Masters: Edit
- Reports: **None**
- Audit: View
- Config: View (read-only; save is admin-only regardless)
- Users: **None**

These defaults cover ~90% of operators. Tighten only if you have a specific reason.

---

### Editing a user

Click the **pencil icon** on any user row. Same fields as Create, except:
- Password is blank — leave it blank to keep the current password, or use **Reset Password** (see below)
- Email is editable
- Changes save immediately and take effect on the user's next action (no re-login needed)

---

### Resetting a password

Click the **key icon** on a user row → enter a new temporary password → Save.

The user will be forced to change it on their next login. Use this when:
- An operator forgot their password
- A person left and you need to lock them out quickly (pair with Deactivate)
- Security incident — you want to rotate credentials

> ⚠️ **Note:** existing sessions are not invalidated by a password reset. If the user is currently logged in somewhere, they stay logged in until their token expires or they log out. For immediate lockout, use **Deactivate** instead.

#### How users reach you — the "Recover" flow

There is **no self-serve email reset** in this app — password recovery is admin-assisted by design. When an operator forgets their password, they click **Recover** on the login screen and see a modal listing all active admins (name + email, with a one-click **Copy** button). They then contact you through any channel (WhatsApp, email, Slack, walk over) asking for a reset.

What you do:
1. Verify the person's identity (obvious in a small team; matters more if you're reached over email)
2. Open **User Management** → find their row → click the **key icon**
3. Enter a temporary password — something short and random is fine, they'll change it immediately on login
4. Share the temp password through the same channel they contacted you on
5. They sign in, get forced to the Change Password screen, set a new one, done

> 📸 *Screenshot: Recover modal on login screen listing admin contacts*

**Why no email-based reset?** This is a desktop app used by a small team with admins nearby. Email-based resets add real risk (SMTP credentials, token handling, spam-folder failures, phishing vectors) for a problem that's solved in 30 seconds by a human.

---

### Deactivating vs deleting

There is **no delete**. Users are **deactivated** (soft-disabled), never hard-deleted.

Why: the audit trail references users by ID. If you hard-deleted a user, every audit row they ever generated would show "unknown user" — audit integrity would break.

**Deactivate** a user when:
- They leave the company
- You're temporarily suspending access (investigation, leave of absence)
- Their role at the company changed and they no longer need Fin-IQ

What happens when you deactivate:
- They can't log in
- Existing sessions are invalidated on their next action (the system re-checks the user on every call)
- Their historical audit entries stay intact and attributed to their name
- You can **Reactivate** later if needed — same account, same history

You **cannot deactivate your own account.** Ask another admin to do it.

---

### The forensic rules (things operators can never do)

Even with "Edit" access, these are **always admin-only**, no exceptions:

| Action | Why admin-only |
|---|---|
| Delete an invoice | Soft-delete with restore — you want accountability |
| Restore a deleted invoice | Reversing a destructive action should be admin-gated |
| Waive PO requirement | Overriding the PO match rules has financial implications |
| Delete audit log entries (non-forensic ones) | Audit trail integrity |
| Change company GSTIN | Master-data change that affects every future posting |
| Save Control Hub config / posting rules / storage path | System-wide settings |
| Create, edit, deactivate other users | RBAC integrity |

Operators attempting these will see `"Admin privileges required"` and the action is blocked.

---

### How to tell what happened and who did it

Open **Audit Trail** (visible to both admins and operators). Every significant action is logged with:
- Who did it (name + user ID)
- What event (Created, Edited, Approved, Auto-Posted, Deleted, Restored, etc.)
- When
- Before/after data where relevant

Operators can read it; only admins can delete entries.

---

## Part B — For Operators

### First login

You'll get an email address and a temporary password from your admin.

1. Open Fin-IQ and go to the login screen
2. Enter your email and temporary password
3. You'll be taken to a **Change Password** page — this is required, you can't skip it
4. Set a strong password you'll remember. Done.

> 📸 *Screenshot: first-login change-password screen*

You'll land on the Dashboard. The sidebar shows only the modules your admin gave you access to.

---

### Your user menu

Bottom-left of the sidebar, you'll see a circle with your initials. Click it to open:
- Your name and email
- **Change Password** — change your password any time
- **Sign Out**

> 📸 *Screenshot: user menu popover*

---

### What you can do

Depends on what your admin enabled. In a typical operator setup:

#### ✅ You can:
- **Upload invoices** — drop PDFs into the AP Workspace, the system runs OCR and populates fields
- **Edit invoice data** — fix OCR errors, add line items, map vendors, assign ledgers
- **Create new vendors** — if an invoice comes from a vendor not yet in the system, add them on the fly
- **Create new ledgers/items** — while editing line items, you can create expense ledgers or stock items (goes to Tally first, then saved locally)
- **Approve invoices** — but only up to your **approval limit** (shown to you if you try to exceed)
- **Revalidate an invoice** — re-run validation if something's stuck
- **Sync to Tally (ERP Sync)** — trigger a pull from Tally to refresh master data
- **Read the audit trail** — see the full history of any invoice
- **View the dashboard** — KPIs, pipeline, PO health

#### ❌ You can't (by design — ask an admin to do it):
- **Delete an invoice** — only admins. If you made a mistake, ask admin to delete and you can re-upload.
- **Restore a deleted invoice** — admin-only.
- **Waive the PO requirement** on an invoice that fails PO validation — admin-only.
- **Approve an invoice above your approval limit** — admin has to approve it, or raise your limit.
- **Change Control Hub settings / posting rules / storage path** — admin-only. You can see them (read-only).
- **Open the Reports page** — admin-only (sensitive cross-company data).
- **See or manage users** — admin-only.
- **Delete audit log entries** — admin-only.

---

### Approval limit — what it is and what happens if you hit it

Your admin sets a **₹ ceiling** on how much you can approve on your own.

- Below the limit → you click Approve, it goes through
- At or above the limit → you see an error like:
  > *"This invoice (₹2,50,000) exceeds your approval limit of ₹1,00,000."*

When that happens, either:
1. Ask your admin to approve this specific invoice, OR
2. Ask your admin to raise your limit (if this is going to be a regular thing)

**Your limit is not a daily/monthly cap** — it's a per-invoice ceiling. You can approve any number of invoices below the limit, every day.

---

### Idle timeout

If you don't touch the app for a while (typically **15 minutes**), the system signs you out automatically for security. You'll be sent back to the login screen and will need to sign in again.

No work is lost — edits you'd already saved are fine. Anything in an unsaved form is gone.

---

### Changing your password

Click your user menu (bottom-left initials) → **Change Password** → enter current + new password → Save.

You can change your password whenever you want. No admin approval needed.

---

### Forgot your password? — the Recover flow

If you **can't remember** your password, the login screen has a **Recover** link next to the password field. Here's what to do:

1. On the login screen, click **Recover** (top-right of the password box)
2. A small modal opens titled **"Recover your password"**
3. You'll see the list of **administrators** who can reset it for you — each with their name and email, and a one-click **Copy** button
4. Pick any admin, click **Copy** next to their email, and contact them through whatever channel your team normally uses (WhatsApp, Outlook, Slack, walk over)
5. Ask them: *"Can you reset my Fin-IQ password?"*
6. They'll set a **temporary password** for you and share it back through the same channel
7. Come back to the login screen, enter your email + temporary password, and sign in
8. You'll be taken straight to the **Change Password** screen — pick a new password you'll remember, save, done

> 📸 *Screenshot: Recover modal showing admin list with Copy buttons*

**Why isn't there an "email me a reset link"?** This app is designed for a small team with admins in the building. The admin-assisted flow is faster (30 seconds) and more secure (no password reset emails that can be phished, no SMTP config to go wrong). If you don't see any admins in the list, contact your IT team — it means no admin is configured yet.

**Things to know:**
- Your temporary password only works once — you'll be forced to change it at first sign-in
- Temporary passwords aren't emailed; they come to you through the admin directly
- If your account has been **deactivated**, the admin will need to reactivate it before the reset will let you in
- If you're currently signed in on another device, the reset doesn't kick you out automatically — you stay signed in there until your token expires or you manually sign out

---

### "Why can't I see X?"

If a module isn't in your sidebar, your admin hasn't given you access to it. Ask them if you need it — it's a two-click change on their side.

If you can see a page but buttons are disabled or say "Admin only", that's intentional — those actions are reserved for admins regardless of your module permission.

---

### "I uploaded an invoice — who does the audit log show?"

You. Every invoice upload, edit, approval, vendor mapping, and ledger creation is logged with **your name and user ID**. The audit trail is how the company tracks who did what.

This is also how your approval limit is enforced — the system knows which authenticated user clicked the button, not just whatever name the app is displaying.

---

## Quick FAQ

**Q: If I'm an admin, can I still see what an operator would see?**
A: No single-click "impersonate" feature exists. You'd need a second account with operator role to see the operator experience.

**Q: If I deactivate a user and then reactivate them, are their permissions preserved?**
A: Yes. Deactivation is just a flag — role, permissions, approval limit, history are all preserved.

**Q: Can two people be logged in on the same computer?**
A: Not at the same time. Signing in as a new user replaces the previous session.

**Q: What happens to invoices an operator approved if I later deactivate them?**
A: Nothing — the invoices stay in whatever state they're in. The audit trail still shows their name as the approver. Deactivation only blocks future actions.

**Q: Can operators see each other's audit entries?**
A: Yes, if they have Audit: View. The audit trail is company-wide, not per-user.

**Q: How do I know if an operator is being productive?**
A: Look at the audit trail filtered by user, or by event type (Created, Edited, Approved). There's no built-in "user dashboard" yet — use the audit view.

**Q: An operator says "nothing works" — what do I check first?**
A: In order:
1. Are they logged in as the right account?
2. Is their account **Active** in User Management?
3. Do they have permissions on the module they're trying to use?
4. If they're trying to approve, is the invoice amount above their approval limit?
5. If they're trying to delete/waive, those are admin-only — route through you.

**Q: An operator forgot their password — what's the fastest path?**
A: Have them click **Recover** on the login screen, copy your email from the modal, and message you. You reset it from User Management (key icon on their row), send them the temp password, they sign in and get forced to change it. Start-to-finish: ~30 seconds.

**Q: Can I email a reset link instead of handing over a temporary password?**
A: No — this app intentionally doesn't send password-reset emails. If you have a real need for email-based self-serve reset (e.g., remote/traveling users), that's a feature that can be added later (requires SMTP config). For the current in-office setup, admin-assisted reset is faster and has a smaller attack surface.

---

## Glossary

- **Role** — Admin or Operator. Determines the baseline of what you can do.
- **Permission** — A per-module setting (None/View/Edit) that refines what an Operator can do. Admins ignore these (they always have Edit).
- **Approval Limit** — Per-invoice ₹ ceiling on what an Operator can approve on their own.
- **Deactivate** — Soft-disable a user. They can't log in but their history and permissions are preserved for reactivation.
- **Audit Trail** — The log of every mutation in the system, with actor attribution.
- **Session** — The logged-in state. Expires on logout, deactivation, idle timeout, or token expiry.
