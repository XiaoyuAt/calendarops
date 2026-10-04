# CalendarOps 产品逻辑 v2 —— 从「日程秘书」到「关系管道 Agent」

> 定位转变：scheduling 不再是产品本身，而是管道中的一个环节。
> 产品要回答的问题是：**如何帮创始人获得更多与客户的沟通、更多与投资人的会面。**

## 一、目标用户与核心诉求

创始人（尤其跨美中时区的服务型公司）每周的时间是恒定资源，瓶颈从来不在"回邮件"，
而在三件事：**找不到足够多的对口客户和投资人、触达后约不上、约上了没准备。**
CalendarOps v2 把这三件事做成一条自动化管道。

## 二、管道漏斗：六个阶段，全部可持久化、可审计

```
① SOURCE 发现        ② RESEARCH 调研       ③ OUTREACH 触达
按 ICP / 投资人画像    每 prospect 深度调研    个性化首触 + 有限跟进
用 Exa 批量找目标  →   决策人/动态/融资史  →   （每日上限、退订即停）→
                                              │
④ NEGOTIATE 约见 ◀── 对方回复 ──────────────┘
   现有 5 动词闭环原样接入（thread 关联 prospect）
        │
        ▼
⑤ BRIEF 会前简报（已有能力：sendOwnerBrief）
        │
        ▼
⑥ NURTURE 跟进：会后 follow-up、未回复冷却再激活、
    owner 每日一封 digest（新回复/新约会/需人工事项）
```

- ①② 是**新增能力**（Exa 已经是现成 primitive，缺的只是批量编排和入库）。
- ④⑤ 是**现有内核**，一行不用改——negotiation.* 五动词就是管道的"约会段"。
- ③⑥ 和调度器是 v2 的主体工作量。

## 三、闸门哲学的延伸：从"谈判升级"到"管道护栏"

现有三道闸门（改期上限 / 钱与合同 / 48h 过期）只管约会段。管道需要再加三道：

| 闸门 | 规则 | 理由 |
|---|---|---|
| 发送频率 | 每 prospect 最多 1 初触 + 2 跟进；全局每日发送上限 | 反垃圾；也呼应 AgentMail 新账户的外部收件人上限——把外部约束变成产品内建护栏 |
| 内容红线 | 报价、条款、承诺类语言一律人工（复用 MONEY_RE 词表） | "agent 跑流程，人做判断" |
| 拒绝即停 | 对方明确拒绝/退订 → prospect 状态 DISQUALIFIED，agent 不再碰 | 保护域名信誉，也是合规底线 |

加上原有的钱闸门，整套哲学一句话：**流程全自主，判断归人类。**

## 四、数据模型扩展（增量，不破坏现有三张表）

见 `schema-pipeline.sql`（草案，尚未在 Neon 执行）：

- `prospect`：管道的核心实体。`type` 区分 customer/investor；`status` 走
  NEW → CONTACTED → REPLIED → MEETING_BOOKED → NURTURE → DISQUALIFIED；
  `fit_score` / `source_query` 记录"为什么找到它"（可审计、可复跑）。
- `outreach`：每次触达留痕（kind: initial/followup/reply，response_at，outcome）。
- `negotiation_thread` 加 `prospect_id` 外键，把约会段挂回管道。

## 五、MCP 工具演进（现有 5 个全部保留）

| 层 | 现有 | 新增 |
|---|---|---|
| 约会段 | negotiation.create / propose / poll / settle，context.research | — |
| 管道段 | — | `pipeline.discover`（画像 → Exa 批量发现 → prospect 入库）<br>`pipeline.enrich`（单/批量深度调研）<br>`pipeline.touch`（首触/跟进，内置频率闸门）<br>`pipeline.digest`（owner 每日摘要） |

## 六、调度器成为引擎（架构上唯一的原空缺）

v1 里"poll 只能被外部调用"是缺陷；在 v2 里它是设计：**一个 cron 循环驱动两件事**——
所有活跃 thread 的 poll、所有到期的 follow-up/outreach。agent 从此自己醒。

## 七、对黑客松 demo 的叙事升级

- v1 故事："转发一封邮件，会议自动约上"——省时间。
- v2 故事："告诉 agent 你的 ICP 和融资阶段，它一周内给你带来 N 次对口会议"——**带来收入与资本**。
- 现场可演示：发现 3 个 lookalike 客户 + 2 个对口投资人 → 调研 → 真实触达（发到自己的测试
  inbox）→ 对方回复 → 自动约见 → 会前简报。

## 八、落地顺序建议

1. **schema-pipeline.sql 入库 + prospect/outreach 的 db 层**（半天）
2. **pipeline.discover / enrich**（复用 Exa，1 天）
3. **pipeline.touch + 频率闸门**（1 天）
4. **调度器 cron + pipeline.digest**（半天）
5. 谈判段内核不动；demo 换成管道叙事
