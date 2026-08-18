---
title: "5.9 系统管理与审计"
description: 规定用户与授权、服务令牌、Webhook 订阅的配置方法，以及审计日志的查询、导出与哈希链校验
---

## 5.9.1 适用范围 {#scope}

本节规定「管理」页四个标签页的使用方法。全部操作均需 `admin` 权限，适用于管理员。

## 5.9.2 用户与授权 {#users}

![用户管理](/img/console/admin-users.png)

<p class="shot-caption">图 5-24　用户管理页面</p>

新建用户时须为其指定一组授权，每条授权由「角色 × 范围」构成。范围类型按表 5-26 的规定。

<p class="tbl-caption">表 5-26　授权范围类型</p>

| 范围类型 | 作用域 |
| --- | --- |
| 全局 | 整个系统 |
| 机组 | 仅该机组内的机台（见 [4.2](/start/gateways/#groups)） |
| 程序库 | 仅该程序库内的程序（见 [5.1](/guide/vault/)） |

一名用户可持有多条授权。例如演示环境中的赵莉持有「编程员 · 钻攻中心组」与
「编程员 · 试制程序库」两条授权，因而可在试制库内编写程序、向钻攻中心组下发，
但无权访问量产库与加工中心组。

角色能力的完整定义见 [6.1](/reference/rbac/)。

密码管理：管理员可执行重置密码；用户在右上角账户菜单中自行修改密码，修改时须提供当前密码。

### 5.9.2.1 认证方式 {#auth-modes}

a) **本地账号**：密码以哈希形式存储，可在完全断网条件下使用，具备登录失败锁定机制；

b) **OIDC 单点登录**（可选）：对接企业身份源，授权关系仍在本系统侧管理。

:::note[说明]
两种认证方式可并存。建议保留至少一个本地管理员账号，以便在企业身份源不可用时仍能登录系统。
:::

## 5.9.3 服务令牌 {#tokens}

机器对机器的集成（MES、CAM 后处理、看板等）应使用服务令牌，不应使用人员账号。

![服务令牌](/img/console/admin-tokens.png)

<p class="shot-caption">图 5-25　服务令牌页面</p>

令牌格式为 `dncp_<id>_<secret>`，调用时置于 `Authorization: Bearer dncp_...` 请求头。

:::caution[注意]
令牌明文仅在创建时显示一次，系统仅存储其哈希值。应在创建时立即记录并按本单位密钥管理制度保管。
遗失后只能吊销重建。
:::

令牌属性按表 5-27 的规定配置。

<p class="tbl-caption">表 5-27　服务令牌属性</p>

| 属性 | 说明 |
| --- | --- |
| 角色与范围 | 适用与人员账号相同的权限规则，不存在越权令牌 |
| 可代理身份 | 允许令牌通过 `X-On-Behalf-Of` 请求头声明本次操作的实际发起人 |
| 高危需操作人 | 启用后，下发、删除等高危操作必须携带操作人，否则拒绝执行 |
| 有效期 | 到期自动失效，亦可随时吊销 |

代理身份用于审计追溯：由 MES 自动触发的下发，审计日志同时记录主体（MES 令牌）
与操作人（提交工单的人员）。

## 5.9.4 Webhook 订阅 {#webhooks}

![Webhook](/img/console/admin-webhooks.png)

<p class="shot-caption">图 5-26　Webhook 订阅页面</p>

可订阅的事件按表 5-28 的规定。

<p class="tbl-caption">表 5-28　可订阅的 Webhook 事件</p>

| 事件 | 触发时机 |
| --- | --- |
| `version.released` | 版本审批通过并放行 |
| `deployment.completed` | 下发通过回读校验 |
| `deployment.failed` | 下发失败，负载中含失败阶段与回滚结果 |
| `drift.captured` | 捕获到一条机边修改 |
| `approval.requested` | 有版本提交审批 |

:::caution[注意]
每个订阅具备独立密钥，投递请求携带签名。接收端应先校验签名再处理负载，
不应直接信任未校验的请求。
:::

「投递记录」表给出每一次投递的事件、状态、尝试次数、HTTP 响应码与最近一次错误信息。
投递失败自动重试，亦可手动执行重新投递。

图 5-26 中，`alert-relay.shop.local` 不可达，重试 3 次后状态仍为「待投递」，
错误原因显示在行内，可据此排查集成故障。

## 5.9.5 审计日志 {#audit}

![审计日志](/img/console/admin-audit.png)

<p class="shot-caption">图 5-27　审计日志页面</p>

审计日志为只增不改的哈希链，每条记录包含前一条记录的哈希值。
任何一条记录被篡改或删除，其后的整条链均无法通过校验。

记录类别按表 5-29 的规定。

<p class="tbl-caption">表 5-29　审计记录类别</p>

| 类别 | 典型事件 |
| --- | --- |
| StateChange（状态变更） | `version.created`、`version.released`、`deployment.requested`、`deployment.completed`、`deployment.failed`、`drift.captured`、`drift.rejected` |
| ContentEgress（内容外流） | `version.view`、`deployment.send` |
| Admin / Auth（管理与认证） | `service_token.created`、`webhook.created`、`gateway.synced`、`auth.login` |

每条记录包含序号、时间、操作者（人员或令牌）、代理操作人、客户端 IP、对象类型与 ID、
变更前后的 JSON、涉及的机台与网关。

### 5.9.5.1 查询与导出 {#query}

操作步骤：

a) 在页面顶部按操作者、机台、对象、类别、时间段设定筛选条件；

b) 核对筛选结果；

c) 单击「导出 CSV」下载当前筛选结果，用于向质量部门或客户提交。

### 5.9.5.2 哈希链校验 {#verify}

操作步骤：单击「校验哈希链」，系统自创世记录起重算整条链。

![哈希链校验](/img/console/audit-verify.png)

<p class="shot-caption">图 5-28　哈希链校验结果</p>

校验通过时显示「哈希链完整（已校验 N 条记录）」；链不完整时给出第一条断裂记录的序号。

:::note[说明]
留存日志与证明日志未被篡改是两个不同的能力。应对客户审核或体系认证时，
哈希链校验结果是后者的直接证据。
:::

## 5.9.6 权限要求 {#permissions}

<p class="tbl-caption">表 5-30　系统管理相关权限</p>

| 操作 | 所需权限 | 具备该权限的角色 |
| --- | --- | --- |
| 用户与授权管理、令牌管理、Webhook 管理 | `admin` | 管理员 |
| 查阅与导出审计日志、校验哈希链 | `admin` | 管理员 |
