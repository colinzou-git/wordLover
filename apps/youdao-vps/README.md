# WordFan Youdao VPS lookup

This dependency-free Python service fetches Youdao's mobile basic-definition page,
normalizes it to WordFan's provider schema, and keeps a small SQLite lookup cache.
Run it behind HTTPS and configure `wordlover-config.js` with its base URL.

```bash
python3 -m unittest apps/youdao-vps/test_server.py
python3 apps/youdao-vps/server.py --database /var/lib/wordfan-youdao/lookups.sqlite
```

The checked-in systemd unit and nginx virtual host are the production deployment
files for `vps-ee890919.vps.ovh.us`. HTTPS is managed by Certbot.
