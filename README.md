# River Company

A static, browser-playable ecological management prototype built with Three.js. No account, backend, or game saves. Employees and robots are intentionally reserved for a future version.

Run `python3 -m http.server 8017 --directory dist` and open http://localhost:8017.

Place the datacenter on land, choose one of three pictorial contracts, and select a construction action before clicking a tile. Drag the landscape to pan; scroll to zoom. Space pauses, S selects servers, R solar, F fossil power, W cooling, X tree cutting, and T planting. Focus the landscape to select tiles with arrow keys and place with Enter. The speed button cycles through 1×, 3×, and 6×. A season lasts six simulated minutes.

Share price is the only purchasing resource. Construction lowers it, contracts raise it, and tree harvesting gives a one-time increase. Computing contracts require adequate server capacity, electricity, and cooling; the contracts header signals the current bottleneck. Fossil expansion is cheaper, produces more electricity, and increases contract returns; solar expansion earns less. Environmental calculations are hidden and expressed through terrain, trees, water, animals, and fire. Environmental stages are local and gradual. At season end, cumulative damage selects the ending; near-total destruction ends the season early.

The ecology and market are fictional game abstractions, not quantitative real-world models. Prototype sound consists of optional procedural interaction and bird-like tones.

Verification: browser rendering, actual pointer placement, clean contract completion and share increase, rejection of river construction, sustainable ending, destructive ending, JavaScript syntax, responsive viewport. WebMCP feature-detects browser support; validation in a supported WebMCP runtime was unavailable.

`dist/three.module.js` and `dist/three.core.js` are locally vendored from the locked Three.js dependency. Its license is included in `dist/THREE-LICENSE.txt`.
