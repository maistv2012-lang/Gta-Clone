# Cathedral Square start and navigation

The reported Arcade start was not reproduced in the current b6a703b build.
Before the change, browser measurements put the player and city.spawn at
(21.0162, 0, -32.4962), about 5.21m from the real OSM Cathedral Square reference.
The preserved fictional district spawn was (3612, 0, 3612), over 5km away.
The always-visible F8 label named the destination, without saying it was a travel
action. It now explicitly says "Ir para" in both directions.

The default start is now selected specifically within 60m of the OSM Cathedral
Square approach. It must belong to the connected walking graph, be on a rendered
pedestrian surface or sidewalk, outside water and at least 3m clear of building
colliders. Selection runs once at initialization, without changing frame-time
rendering, geometry batching, shaders, materials or touch input. Failure is explicit;
this spawn selection cannot silently fall back to Arcade District.

With the bundled extract, the selected point is (21.797881, 0, -33.471629), 3.97m
from the square's reference. Near-spawn shop placement reserves that location.
Real-map respawn uses the same safe point rather than adding an unchecked (3,3)
offset. Legacy-mode respawn retains its original offset. Existing save progress is
retained; reload starts at the real point rather than taking coordinates from an
old save. Minimap drawing runs before PLAY reveals the scene; existing following
and scaling are preserved.

`npm run test:spawn` verifies real geometry, connected walking access to Colombo
and both halves of Hagley Park, legal driving access to Colombo, synthetic-fixture
compatibility, and explicit failure for absent/blocked Cathedral Square.

`npm run test:spawn:browser` captures actual desktop and mobile initial scenes,
checks the minimap arrow at its centre, preserves progress from a legacy save and
checks reload. It walks the connected path from the actual spawn to Colombo Street
using movement input, without teleporting that walking route. A separate driving
check positions an existing car on a clear legal Colombo lane and accelerates it
using input. This car setup does not simulate walking to and entering that car.

The existing real-map suite now asserts actual initial location and kiosk/building
clearance before any test teleports. Its mobile movement test starts at the actual
spawn. The F8 tests still exercise the preserved Arcade District and return trip.

All screenshots here were produced by Chromium with software WebGL on Linux,
including mobile emulation; not a physical phone or native Windows. Scene and
mobile-start screenshots were visually inspected. No graphical-style change or
map refresh was made. Data SHA256 remains
8450e30bcfd21904980edd981025eb11816eed46b8acd299e1ac158694111c46.

Final executed test counts are recorded in RESULTS.md when validation completes.
