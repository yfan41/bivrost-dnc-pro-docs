---
title: "5.9. 管理与审计"
description: 用户与授权、服务令牌、Webhook 订阅、审计日志与哈希链校验
---

**管理**页有四个标签页，都需要 `admin` 权限。

## 用户 {#users}

![用户管理](/img/console/admin-users.png)

新建用户时给的是一组**授权**，每条授权是 `角色 × 范围`：

| 范围类型 | 含义 |
| --- | --- |
| **全局** | 整个系统 |
| **机组** | 仅这个[机组](/start/gateways/#groups)里的机床 |
| **程序库** | 仅这个[程序库](/guide/vault/)里的程序 |

一个人可以有多条授权。例如演示环境里的赵莉是
`编程员·钻攻中心组` + `编程员·试制程序库`——她能在试制库里写程序，
也能往钻攻中心下发，但碰不到量产库和加工中心组。

角色能力见[角色与权限](/reference/rbac/)。

管理员可以**重置密码**；用户自己在右上角账户菜单里**修改密码**（需要提供当前密码）。

### 本地账号与 OIDC {#auth-modes}

- **本地账号**：密码存哈希，完全离网可用。有登录失败锁定
- **OIDC 单点登录**（可选）：接企业身份源。授权仍在 DNC Pro 侧管理

两者可以并存——SSO 挂了的时候本地管理员账号仍能进。

## 服务令牌 {#tokens}

机器对机器的集成（MES、CAM 后处理、看板）用**服务令牌**，不要用人的账号。

![服务令牌](/img/console/admin-tokens.png)

令牌形如 `dncp_<id>_<secret>`，**只在创建时显示一次**，系统只存哈希。
调用时放在 `Authorization: Bearer dncp_...`。

令牌的属性：

| 属性 | 含义 |
| --- | --- |
| **角色与范围** | 和人一样的 RBAC，没有"超级令牌" |
| **可代理身份** | 允许令牌通过 `X-On-Behalf-Of` 头声明"这次操作实际是谁发起的" |
| **高危需操作人** | 开启后，下发、删除这类高危动作**必须**带上操作人，否则拒绝 |
| **有效期** | 到期自动失效；也可以随时**吊销** |

代理身份的价值在审计上：MES 自动触发的下发，审计日志里会同时记录
"主体 = MES 令牌"和"操作人 = 提交工单的那个人"。

## Webhook {#webhooks}

![Webhook](/img/console/admin-webhooks.png)

可订阅的事件：

| 事件 | 触发时机 |
| --- | --- |
| `version.released` | 版本审批通过并放行 |
| `deployment.completed` | 下发通过回读校验 |
| `deployment.failed` | 下发失败（含失败阶段与回滚结果） |
| `drift.captured` | 捕获到一条[机边修改](/guide/drift/) |
| `approval.requested` | 有版本提交审批 |

每个订阅有独立的密钥，投递请求带签名，接收端应当校验后再处理。

**投递记录**表给出每一次投递的事件、状态、尝试次数、HTTP 响应码和最近错误。
失败会自动重试；也可以手动**重新投递**。

上图里 `alert-relay.shop.local` 不可达，重试了 3 次仍是"待投递"，
错误原因写在行内——这正是排查集成问题需要的信息。

## 审计日志 {#audit}

![审计日志](/img/console/admin-audit.png)

审计是**只增不改的哈希链**：每条记录包含前一条的哈希，
任何一条被篡改或删除，后续整条链都对不上。

记录分三类：

| 类别 | 例子 |
| --- | --- |
| **StateChange**（状态变更） | `version.created` `version.released` `deployment.requested` `deployment.completed` `deployment.failed` `drift.captured` `drift.rejected` |
| **ContentEgress**（内容外流） | `version.view` `deployment.send` |
| **Admin** / **Auth** | `service_token.created` `webhook.created` `gateway.synced` `auth.login` |

每条记录都带：序号、时间、操作者（人或令牌）、代理操作人、客户端 IP、
对象类型与 ID、变更前后的 JSON、涉及的机台与网关。

### 查询与导出 {#query}

顶部可按**操作者 / 机台 / 对象 / 类别 / 时间段**筛选，
**导出 CSV** 把当前筛选结果下载下来交给质量或客户。

### 校验哈希链 {#verify}

点**校验哈希链**，系统从创世块开始重算整条链：

![哈希链校验](/img/console/audit-verify.png)

<p class="shot-caption">「哈希链完整（已校验 165 条记录）」——链不完整时会指出第一条断裂的序号</p>

:::note[为什么这件事重要]
"我们有日志"和"我们能证明日志没被改过"是两回事。
应对客户审核或体系认证时，后者才有说服力。
:::
