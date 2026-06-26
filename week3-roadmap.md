# Faultline — Week 3 Roadmap (D15–D21)

## 7-Item Niche Health Check

| # | Niche | Score | Notes |
|---|-------|-------|-------|
| 1 | 真问题 + 清晰用户 | 4 / 5 | "给预测市场交易员，找出共识价格背后的脆弱假设" — 清晰，痛点经得起追问 |
| 2 | 闭环 Demo | 4 / 5 | WorldModel → 3 Personas → Aggregator → Sub-market → On-chain → Dashboard 全链路跑通，Vercel URL 在线 |
| 3 | 魔法时刻 | 3 / 5 | 概念强，但当前快照只聚合 1 条假设、subMarket 全为 null，GAP 发现这个最强亮点没在 Demo 里展示出来 |
| 4 | 链上可验证 | 4 / 5 | Base Sepolia SnapshotRegistry 已部署，README 顶部有 Basescan 链接，Dashboard on-chain log 可点击 |
| 5 | 文档 | 3 / 5 | README 8 模块基本齐全，缺可视化架构图、缺"Why this fits [赛事]"段落、评委视角打磨不足 |
| 6 | Pitch / Demo 视频 | 0 / 5 | **不存在**，Week 3 最高优先级任务 |
| 7 | 赛事方匹配度 | TBD | D19 锁定赛事后回填 |

**总分：18 / 30 — 中等（D16 加做叙事二审）**

最低 3 项：
- **Niche 6 (0)** — Demo 视频从零做：≤3 分钟，前 10 秒只说问题，中段完整演示，结尾 Roadmap
- **Niche 3 (3)** — 魔法时刻不可见：确保演示时至少 1 个 subMarket GAP 出现，或换有子市场的热门标的
- **Niche 5 (3)** — README 缺可视化架构图 + "Why this fits" 段落

---

## 候选赛事（D19 前锁定）

### 候选 1：Base Builder Grants（Grant，滚动申请）
**链接**：https://docs.base.org/get-started/get-funded / https://gitcoin.co/apps/base-builder-grants

① **资格**：完全开放，无 fresh code 要求，任何已部署 Base 生态项目可申请。Faultline 已使用 Base Sepolia（SnapshotRegistry + Farcaster）天然符合。
② **截止时间**：滚动申请，无固定 deadline。不早于 D21（6/28），随时可提交。
③ **赛道契合度**：高。Faultline = AI Agent × Base Sepolia 链上锚定 × Farcaster 发帖，完整 Base 生态使用链。
④ **交付物**：GitHub 仓库 + README（含 Base 使用说明）+ Live URL + use-of-Base 描述段落。
⑤ **投**：YES。天然命中，门槛低，交付物和 Week 3 重叠度 100%。

**技术栈缺口**：OnchainKit（Coinbase 官方 Base SDK）——当前用 viem 裸调合约，可用 OnchainKit 替换 Dashboard 的钱包连接/合约读取部分。接入成本：约 0.5 天，低风险。

---

### 候选 2：ETHGlobal Lisbon 2026（线下黑客松，观望）
**链接**：https://ethglobal.com/events/lisbon2026/apply

① **资格**：首次设立 **Continuity Track**（已有真实用户的在建项目无需从空白仓库开始），Faultline 以此身份参赛合规。⚠️ 线下活动，需本人在葡萄牙里斯本，有差旅成本。
② **截止时间**：2026-07-26（北京时间 07-27 约 01:00），晚于 D21（6/28）。🟡 不急，但需提前报名获批准。
③ **赛道契合度**：高。已确认 AI×Crypto 赛道，Faultline 的"AI 反锚定 + 预测市场 + 链上证明"叙事直接命中。赞助商含 1inch、Sui、World——World ID 可低成本挂（为研究员身份验证）。
④ **交付物**：GitHub + Live URL + Demo 视频 + 现场 Pitch（36 小时 hacking）。
⑤ **候选（观望）**：Continuity Track 是今年新增亮点，非常适合 Faultline；但线下参赛对中国参赛者有签证+差旅障碍。若能赴葡，优先考虑；否则聚焦候选 1 Grant。

**技术栈缺口**：World ID — 可加到 Dashboard（人类研究员认证）。接入成本：约 1 天。1inch Fusion — 不相关，跳过。

---

### 候选 3（池外线上）：CROO Agent Hackathon
**链接**：https://dorahacks.io/hackathon/croo-hackathon  
**平台**：DoraHacks，线上全球开放 ｜ 奖池：$10,000 USD，6 赛道

① **资格**：线上开放，无 fresh code 要求，现有项目可参赛。核心要求：在 CROO Agent Store 上架可调用 Agent，集成 CROO Agent Protocol（CAP），完成至少 1 次真实 USDC 结算。
② **截止时间**：2026-07-09（北京时间 7月10日约 08:00），晚于 D21（6/28），Week 3 结束后还有 11 天冲刺窗口。
③ **赛道契合度**：中高。官方示例 Agent 里已有 **Polymarket Broker**（"AI analysis + paid agent services for prediction markets"），Faultline 的假设审计功能直接重合，包装成"按次收费的 Assumption Auditor Agent"即可命中。
④ **交付物**：CROO Agent Store 可调用 Agent + GitHub + Demo 视频（展示调用 → USDC 付款 → 返回 audit 全流程）。
⑤ **投（推荐）**：改造成本约 1.5～2 天——在现有 worker 上加 HTTP 接口（接收 question → 返回 audit JSON）+ CAP SDK 收费层，核心 Demo 不动。D19 后完成 Agent 上架，是最适合线上单独提交的选项。

**技术栈缺口**：CROO Agent Protocol SDK（CAP）— 加 Express 接口 + CAP 集成 + USDC 结算，约 1.5 天。

---

## Week 3 五天计划

| 天 | 核心任务 | 目标 Niche |
|----|---------|-----------|
| **D16** | 叙事重构：重写 Tagline / One-liner / Pitch 开头（从"技术驱动"→"用户驱动"），让"市场共识是一个隐藏赌局"这句话成为第一句话 | Niche 1, 3 |
| **D17** | 评委级 README：加可视化架构图（Mermaid/ASCII 升级版）+ "Why this fits Base / ETHGlobal" 段落 + Quick Links 置顶强化 | Niche 5 |
| **D18** | **Demo 视频**（最高优先级，0→4）：录 ≤3 分钟，前 10 秒只说痛点，中段跑完整链路，结尾 Roadmap + Farcaster cast 截图 / on-chain TX。同时制作 4-6 页 Pitch Deck | Niche 6, 3 |
| **D19** | 锁定目标赛事（Base Grants 必投，Lisbon 按情况）；填 Niche 7；确认所有 Quick Links 可点击；实际提交 | Niche 7 |
| **D20** | 周六直播：让 AI 按 7 项再过一遍；补薄弱点；准备 Q&A | 全项 |

---

## 风险点

- **魔法时刻依赖实时数据**：当前 FIFA 世界杯市场的子市场 GAP 为 null，演示效果弱。建议 D16-D17 测试 2-3 个高热度市场（如美国大选相关、宏观经济），挑一个能稳定出现 subMarket GAP 的作为演示标的。
- **Demo 视频依赖 worker 实时运行**：录制时需要 worker 在本地/服务器跑起来，确保 D18 录制时环境就绪（含 HTTPS_PROXY）。
- **ETHGlobal Lisbon 线下参赛**：签证 / 差旅时间紧，D19 前决策是否赴会。

## 求助点

- Niche 3 的"魔法时刻"优化：如何让 sub-market GAP 在演示中稳定可见（换标的？调搜索逻辑？）
- Demo 视频录制工具选择（推荐 Loom / OBS + Figma 封面）
