# Final first-stage visual validation

All checks below were executed in this task against the current implementation.
The tree-visibility and livery-offset corrections have an additional focused test.
The facade source-level correction has its own Novotel metadata unit check.

| Check | Result |
| --- | --- |
| New visual profiles/camera/source-geometry/ray-fan/source-level units | 7/7 |
| Existing spawn units | 6/6 |
| Existing graph units | 10/10 |
| Existing loader units | 7/7 |
| Real OSM provenance, named landmarks, legal left lanes | Passed; original SHA256 |
| Actual desktop/mobile visual suite, Low/Medium/High + 30/60 targets + Brick/rig | Passed |
| Missing material preserves menu with explicit texture filename | Passed |
| Startup suite, nested path, warm service worker, 4x CPU slowdown | 11/11 |
| Real map integration, collision, police, missions, touch | 20/20 |
| Walk from actual Square spawn to Colombo, drive on Colombo, save/reload/respawn | Passed desktop/mobile |
| Full existing feature audit, legacy/Low | Final 57/57; runtime errors 0 |
| Existing mobile controls, combat, interactions, vehicles | 10 PASS, no FAIL, errors 0 |
| Preview visual/pixel/error/cache/float-target compatibility | 9/9 |
| Synthetic fixture integration | 19/19 |
| Focused all-trunk visibility and livery outside body in every profile | Passed |
| Texture dimensions/decoding | All valid, max 512×512; leaf map 256×256 |
| JavaScript syntax | 184 modules passed |
| Whitespace/source integrity | Passed; no tracked files deleted |

The first full feature audit was 56/57; see regression-first.log and the investigation
in ../../VISUAL-DEMO.md. The original 0.8s/>1m swing assertion was retained. A wide,
clear facade makes its ray-fan target unambiguous; no web physics or forces changed.
The complete final audit was rerun rather than reporting a targeted pass alone.

PBR maps and geometry are not enough to certify image-reference realism. The
rendered outcome remains visibly stylised. The software-renderer samples were
~0.61 FPS desktop High and ~1.07 FPS mobile Medium, NOT a Galaxy/Windows benchmark.
Stable physical-device 30 FPS, thermal/memory behaviour and every seasonal suite
were not verified. Shader fallback, explicit errors and real rendered pixels were
verified. See ../results.json for exact timing/profile/call data.

No live OSM refresh, engine version replacement, main merge or production deployment
was performed. Geography SHA256:
8450e30bcfd21904980edd981025eb11816eed46b8acd299e1ac158694111c46.
