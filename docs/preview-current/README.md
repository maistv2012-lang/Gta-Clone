# Current-environment Preview verification — 2026-11-06

The newly selected environment had no TCP listener on 8080, 3000 or 5173.
Checked outside the command network sandbox: connect_ex returned ECONNREFUSED
(111). This establishes a local server outage, not the cause of the authenticated
phone Preview, whose URL is unavailable (Companion page_id/document_view null).

Started the existing npm start command in /workspace/Gta-Clone on port 8080.
HTTP responses for index.html, boot.js, graphics.js, main.js, sw.js and the OSM
extract were 200 and byte-for-byte identical to disk. Hashes/headers are recorded
in http-verification.json. All had Cache-Control no-cache, no-store, must-revalidate.
No production files changed. Existing game and map remain intact.

A fresh local entry URL was tested:
http://localhost:8080/?preview=20261106-current
This query is a distinct navigation URL, not a new origin or a guarantee of
service-worker bypass. Normal navigation was captured with worker=false; the
separate blocked-worker case also entered the visible 3D scene. Warm worker reload
and compatible WebGL rendering also succeeded. See results.json when complete,
per-case console/network logs and actual PNG captures. This is Chromium mobile
emulation with software WebGL, not the physical S24 Ultra.

The local address is not a public phone-accessible URL. No public Preview creation
or forwarding tool was available, and no authenticated hosted endpoint was tested.
No deployment, publication or environment configuration change was performed.
The npm server is left running, but an environment replacement can terminate it.
