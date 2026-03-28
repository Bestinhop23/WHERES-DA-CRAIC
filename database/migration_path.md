# MVP to Final Demo Migration Path

1. Add `users`, `pubs`, `rewards_log`, and `checkins` tables from `craic_schema.sql`.
2. Seed pubs from `cupan-caife-web/src/data/pubs.json` into `pubs`.
3. Backfill existing wallet/local events into `rewards_log` where possible.
4. Switch frontend to API-backed wallet and pub discovery (`/api/pubs`, `/api/wallet/:userID`).
5. Route NFC tag URLs to `/redeem?pubID=<pub_id>` and call `POST /api/redeem`.
6. Turn on strict fraud checks in backend (device + geo + frequency scoring) after pilot.
7. Enable pub dashboard integrations with `GET /api/dashboard/pub/:pubID/metrics`.
