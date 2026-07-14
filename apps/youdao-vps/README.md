# WordFan Youdao VPS lookup

This owner-operated personal-use Python service retrieves Youdao's mobile basic-definition page, normalizes it to WordFan's provider schema, and persists successful entries in SQLite.

Project scope:

- [`docs/youdao-personal-use-scope.md`](../../docs/youdao-personal-use-scope.md)
- [`docs/youdao-two-layer-cache-design.md`](../../docs/youdao-two-layer-cache-design.md)
- tracking issue: #104

## Required cache behavior

```text
WordFan device IndexedDB hit
    -> no gateway request

WordFan device miss
    -> VPS SQLite hit
       -> return cached entry without another Youdao retrieval
    -> VPS SQLite miss
       -> retrieve + normalize + validate
       -> persist SQLite
       -> return entry
       -> PWA persists encrypted local copy
```

Valid gateway records do not expire automatically. Explicit Refresh retrieves a fresh entry and replaces the existing row only after successful parsing and validation. A failed refresh must preserve the previous valid row.

The normal client removal action removes only the device copy. It does not erase the gateway SQLite cache; the device may later be rehydrated from the gateway.

## Run

```bash
python3 -m unittest apps/youdao-vps/test_server.py
python3 apps/youdao-vps/server.py --database /var/lib/wordfan-youdao/lookups.sqlite
```

The checked-in systemd unit and nginx virtual host are the deployment files for `vps-ee890919.vps.ovh.us`. HTTPS is managed by Certbot.

## Implementation requirements

The current cache is functional but issue #104 requires additional hardening:

- migrate to a versioned SQLite record schema;
- validate cached payload, provider, schema, and exact normalized term before reuse;
- make Refresh replacement atomic;
- avoid unsafe concurrent use of one SQLite connection under `ThreadingHTTPServer`;
- add cache-hit, restart, migration, refresh-failure, invalid-row-repair, and concurrent-request tests;
- expose gateway cache hit/miss/refresh status for diagnostics;
- keep ordinary repeated terms in SQLite permanently until explicit refresh, repair, or schema migration.
