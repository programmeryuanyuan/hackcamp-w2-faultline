# Faultline

**Every prediction market is a hidden bet on a set of assumptions — Faultline makes them visible, ranked, and priced.**

## Quick Start

```bash
# Worker (polls Polymarket every 60s, writes snapshot.json)
cd worker
cp .env.example .env   # fill in OPENAI_API_KEY
npm install
# If Polymarket is blocked in your region:
HTTPS_PROXY=http://127.0.0.1:7897 npm run dev

# Web dashboard (localhost:3000)
cd web
npm install
npm run dev
```

## How It Works

Instead of outputting a probability, Faultline asks: **what assumptions must hold for this market to resolve YES, and which of them is most likely to fail?**

1. **World Model** fetches the highest-volume active Polymarket binary market (question, description, current price)
2. **Three personas** reason independently — *without seeing the market price* (anti-anchoring):
   - **Fundamentals Analyst** — political, economic, structural conditions
   - **Event Horizon** — timeline and deadline risk
   - **Contrarian** — silent assumptions everyone ignores
3. **Aggregator** deduplicates overlapping assumptions and ranks by fragility (`high / medium / low`)
4. **Sub-market search** (Variant G) — queries Polymarket Gamma API for existing markets that directly price each assumption; shows the price GAP vs. the parent
5. **Dashboard** displays the ranked assumption audit with colored fragility cards and sub-market spreads

## Architecture

```
Gamma API (price + description)
        ↓
  World Model          →  snapshot.json
        ↓  broadcast (no price — anti-anchoring)
  Persona × 3          →  structured tool_call output
        ↓
  Aggregator           →  deduplicate + rank by fragility
        ↓
  Sub-market Search    →  find existing Polymarket markets per assumption
        ↓
  Dashboard            →  Next.js reads /public/snapshot.json every 30s
```

## Output Example

```
[1] HIGH  "Iran's Supreme Leader Khamenei must remain in power"
    Breaking event: Leadership transition or incapacitation
    When: Within 30 days
    Sub-market: "Will Khamenei remain Supreme Leader through June 2026?" → 78% (GAP +21%)

[2] MEDIUM  "US domestic politics allows a deal before the deadline"
    Breaking event: Congressional backlash blocks ratification
    When: 2–4 weeks
    Sub-market: none found

[3] LOW  "Neither side walks away due to domestic pressure"
    Breaking event: Iranian hardliner factions force withdrawal
    When: 1–3 months
```

## Day Plan

| Day | Deliverable |
|-----|------------|
| D1  | World Model polling + Dashboard chart ✅ |
| D2  | Assumption Auditor (3 personas + aggregator) ✅ |
| D3  | Sub-market GAP search ✅ |
| D4  | Farcaster cast (Neynar managed signer) |
| D5  | SnapshotRegistry on-chain proof (Base Sepolia) |
| D6  | Vercel deploy + demo polish |

## Roadmap

- [x] World Model polling (Gamma API)
- [x] Dashboard probability chart
- [x] Anti-anchoring persona agents
- [x] Assumption ranking by fragility
- [x] Sub-market GAP search
- [ ] Farcaster pre-audit cast (D4)
- [ ] SnapshotRegistry on-chain proof (D5)
- [ ] News trigger: detect assumption-breaking events in real time

## Why This vs. Other Approaches

| Project | Swarm | Anti-anchor | Assumption output | Sub-market GAP | Farcaster |
|---------|-------|-------------|-------------------|----------------|-----------|
| Polystrat (Olas) | ✅ | ❌ | ❌ | ❌ | ❌ |
| Polybro | RAG | ❌ | ❌ | ❌ | ❌ |
| **Faultline** | ✅ | ✅ | ✅ | ✅ | soon |

Faultline is the first system to answer *"what is the market implicitly betting on?"* rather than *"what probability should I assign?"*
