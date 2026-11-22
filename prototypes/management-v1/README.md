# River Company

**Local only. Do not deploy unless explicitly requested.**

A static, browser-playable ecological management prototype built with Three.js. No account, backend, or game saves. Employees and robots are intentionally reserved for a future version.

Run `npm run dev` and open http://localhost:8017.

Place the datacenter on land, choose one of three pictorial contracts, and select a construction action before clicking a tile. Click or tap any datacenter building to enter its cutaway interior, with six large server racks and four workers walking through the aisles. The simulation and contracts continue inside. Online rack lights reflect the selected building’s electricity and cooling; workers stop while paused. Scroll or use +/− to zoom inside. Return with the Valley button or Escape; the valley camera and construction selection are preserved.

Drag the landscape to pan; scroll to zoom. Space pauses, S selects another datacenter, R solar, F fossil power, W cooling, X tree cutting, and T planting. Focus the landscape to select tiles with arrow keys and place with Enter. The speed button cycles through 1×, 3×, and 6×. A season lasts six simulated minutes.

Cash pays for construction and planting; processing active contracts and harvesting trees earn cash. Contract acceptance does not pay cash. Each unit of completed work earns a proportional share of the payout, locked when signing. Stalled work earns nothing; completion never pays twice. Failed deliveries retain their work earnings but incur the existing deadline penalty. A larger active progress bar, percentage, processing coin animation, and shortage icons distinguish work completion from the deadline ring. The separate stock chart reflects installed infrastructure, usable AI capacity, active contracts, and delivery reputation. Spending cash does not spend share value.

The initial datacenter has no electricity: build a solar panel or fossil generator to bring it online. Every additional datacenter provides one unit of AI capacity and consumes one unit each of electricity and cooling when operating. Solar supplies one electricity unit; fossil generators supply three. Cooling upgrades add three cooling units. Icon bars show electricity, online AI capacity, and cooling relative to installed datacenters; shortage bars turn orange and idle datacenter lights go dark. Contracts continuously read online capacity, including infrastructure built after signing. Processing speed equals online datacenters divided by the contract workload tier: one online datacenter runs a modest contract at 1×, a growing contract at 0.33×, or an ambitious contract at 0.17×. Additional powered and cooled datacenters increase speed without a cap; unsupported datacenters stay idle. Zero online capacity stops work and earnings. The active card displays processing speed and the infrastructure limiting it. Fossil infrastructure increases cash returns at an environmental cost; solar earns less. Contract rewards remain pictorial. Environmental effects and the two endings remain unchanged.

The ecology and market are fictional game abstractions, not quantitative real-world models. Prototype sound consists of optional procedural interaction and bird-like tones.

Verification: cash/stock separation, infrastructure purchase costs, unpaid contract acceptance, electricity and cooling bottlenecks, capacity expansion, successful contract payouts, failed delivery penalties, cash-based affordability, browser console, JavaScript syntax, and mobile layout. The initial version also exercised both endings and river-placement rejection. WebMCP feature-detects browser support; validation in a supported WebMCP runtime was unavailable.

`dist/three.module.js` and `dist/three.core.js` are locally vendored from the locked Three.js dependency. Its license is included in `dist/THREE-LICENSE.txt`.
