# Support API (member side) — Workstream D

Authenticated members (including **suspended** members, so they can appeal) manage their own tickets.
Staff endpoints are documented in `admin.md` (`/admin/support/tickets`).

| Method | Path | Body / Response | Notes |
|---|---|---|---|
| GET | `/support/tickets` | `Ticket[]` (`id, subject, category, status, priority, created_at, updated_at`) | own tickets, newest activity first |
| POST | `/support/tickets` | `supportTicketSchema` `{ category, subject, body }` → `Ticket` | 10/hour; `safety` tickets start at `high` priority |
| GET | `/support/tickets/[id]` | `{ ticket, messages[] }` | internal staff notes are never returned; 404 for other members' tickets |
| POST | `/support/tickets/[id]` | `supportReplySchema` `{ body }` | 30/hour; reopens the ticket (`open`); closed tickets reject replies (409) |

Statuses: `open` (with the team) → `pending_user` (staff replied; member notified via in-app `support_reply`) →
`resolved` / `closed`. Categories: `account, billing, verification, safety, technical, feedback, other`.

Web UI: `/app/support` (list + new request) and `/app/support/[id]` (thread).
