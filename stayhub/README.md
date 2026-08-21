# Stay Hub

## About
- StayHub is an app like Air BnB for short-term rentals.
- People or customers can go on this app and reserve a stay at a place.

## Requirements
- Behave and look like Air BnB(https://www.airbnb.com) but not the logo or styling.
- use react for the frontend with Tailwind CSS.
- Use one backend project to serve both, use fastapi as a framework(all create,update,delete should be served from this backend project). Use sqlalchemy with fastapi. Make sure to use professional code structure to keep classes in different layers of the project.
- Use hasura as a graphsql(all reads should come from hasura)
- Use postgres as the database.
- Customers must be able to sign up and sign in, view a house and make a booking, pay for it.
- Customers must be able to cancel a booking all the way up to 2 days before start date.
- Hosts must be able to sign up and sign in, add a house to show
- Use elasticsearch and sink data from postgres for just the houses so searching is fast. Do this sync in the code.
- User docker composer for services needed. Change port if already taken

- Publishable key: pk_test_51U6lc767a3bv3VDo8tOKoYDkC2hcCd3QpC4tBT5xXvWI4IkCWBZTJSxme7DbJclzKoaDqT1NwzlgMgZVhZ0viW2w00ZJNrSPyg
- Secret key: sk_test_51U6lc767a3bv3VDoK4Ew6ocFNhSsbik6CtszbAaQMd6JCrT7fXOVUwFWFimorIUU9Px83vN8e6Orwh24l7XmOhff00RRan7iAd
---

## Status

Built and working end to end. **Read `progress_report.md` first** — it holds the decisions, the
gotchas already paid for, and what is still open. `CLAUDE.md` holds the standing instructions.

| | |
|---|---|
| Backing services | `docker compose up -d` — postgres **5433**, hasura **8081**, elasticsearch **9200** |
| API | http://localhost:8000 — docs at `/docs` |
| Customer + host app | http://localhost:5174 |
| Admin console | http://localhost:5175 |
| Tests | 58 backend · 32 customer e2e · 7 admin e2e |

Demo logins: `guest@stayhub.test` / `guest123` · `host@stayhub.test` / `host123` ·
`admin@stayhub.test` / `admin123`

### Two requirements resolved with a documented exception

1. **Hosts live in the customer app**, not the admin app — Airbnb has no separate host site, and
   hosting is a mode of a normal account rather than a privilege level. `/hosts/*` is role-gated.
2. **"All reads from Hasura" and "Elasticsearch for search" cannot both hold**, because Hasura
   reads Postgres and the point of the index is to not read Postgres. `GET /api/v1/search` is the
   single, explicit exception; every other read is a GraphQL query.
