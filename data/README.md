# Christchurch geographic data

`christchurch.json` is a real extract downloaded on 6 November 2026 (UTC),
from the official OpenStreetMap API. It contains 9,139 highway ways and 11,353
areas, including Cathedral Square, Colombo Street, and North/South Hagley Park.
`christchurch-validation.json` records connected walking approaches and their
OSM IDs. Coordinates are local metres about latitude -43.5308, longitude 172.6366.

Run `npm run map:fetch` from the repository root to refresh. It first requests
the Overpass extract. If that service fails (HTTP 406 was observed), it uses
`www.openstreetmap.org/api/0.6/map.json` in twelve serial tiles. Small tiles
respect the official map API's 50,000-node limit. Objects are merged by type/ID
and version; missing members of park multipolygons are fetched explicitly.
The requested extent is latitude -43.545 to -43.515 and longitude 172.605 to
172.650. Complete OSM ways can extend slightly beyond that rectangle.

The raw responses are temporary. The output records source URL/type, retrieval
date, origin and license. The map API does not provide a single Overpass-style
snapshot timestamp: `timestamp` is null and `retrievedAt` records acquisition,
not an atomic database snapshot. A failed validation leaves the existing prepared
file intact. Runtime gameplay uses the bundled file without querying either API.

Source: [OpenStreetMap contributors](https://www.openstreetmap.org/copyright).
Database license: [ODbL 1.0](https://opendatacommons.org/licenses/odbl/1-0/).
The game displays attribution linking to OSM's copyright/license page. Keep
that attribution when distributing the prepared data. Preserve the source and
timestamp fields when refreshing it.

V1 supports highway ways, closed building footprints, closed park/garden ways,
closed water ways, and park/garden multipolygons with inner rings. Turn-restriction
relations, elevations, bridge/tunnel clearances and architectural facades need
further work. Oneway directions and roundabout directions are handled; the
extract validator rejects missing landmarks or disconnected walking routes.
The real extract passes named-place connectivity checks and all 27,473 driving
edges were checked against the source directions and left-lane geometry.

`test/fixtures/christchurch-synthetic.mjs` is artificial test topology. It is
only intercepted by the browser integration test, never loaded by the game.
