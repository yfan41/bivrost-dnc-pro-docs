---
title: "6.1 角色与权限"
description: 规定五个固定角色与十三项权限的对应矩阵、授权范围的判定规则与常见错误码的含义
---

## 6.1.1 适用范围 {#scope}

本节规定本系统的访问控制模型。适用于管理员配置授权，亦作为其他各节权限要求的判定依据。

## 6.1.2 设计原则 {#principles}

a) **角色固定，不可自定义。** 五个角色对应车间中实际存在的五类职责。
   可自定义角色的系统在实践中会退化为每人一个角色，失去审计意义；

b) **范围可变。** 同一角色可仅作用于某个机组或某个程序库；

c) **人员与令牌适用同一套规则。** 不存在越权令牌。

## 6.1.3 权限矩阵 {#matrix}

角色与权限的对应关系按表 6-2 的规定。

<p class="tbl-caption">表 6-2　角色与权限矩阵</p>

| 权限 | 只读 | 操作工 | 编程员 | 审批员 | 管理员 |
| --- | :---: | :---: | :---: | :---: | :---: |
| `programs.read` 查阅程序与元数据 | <span class="sup-y">✓</span> | <span class="sup-n">✗</span> | <span class="sup-y">✓</span> | <span class="sup-y">✓</span> | <span class="sup-y">✓</span> |
| `programs.read.released` 仅查阅已发布版本 | <span class="sup-y">✓</span>ᵃ | <span class="sup-y">✓</span> | <span class="sup-y">✓</span>ᵃ | <span class="sup-y">✓</span>ᵃ | <span class="sup-y">✓</span> |
| `programs.content.view` 查阅、下载正文 | <span class="sup-n">✗</span> | <span class="sup-n">✗</span> | <span class="sup-y">✓</span> | <span class="sup-y">✓</span> | <span class="sup-y">✓</span> |
| `programs.write` 建程序、传版本、建分配 | <span class="sup-n">✗</span> | <span class="sup-n">✗</span> | <span class="sup-y">✓</span> | <span class="sup-n">✗</span> | <span class="sup-y">✓</span> |
| `versions.submit` 提交审批 | <span class="sup-n">✗</span> | <span class="sup-n">✗</span> | <span class="sup-y">✓</span> | <span class="sup-n">✗</span> | <span class="sup-y">✓</span> |
| `approvals.decide` 批准、驳回 | <span class="sup-n">✗</span> | <span class="sup-n">✗</span> | <span class="sup-n">✗</span> | <span class="sup-y">✓</span> | <span class="sup-y">✓</span> |
| `deployments.send.released` 下发已发布版本 | <span class="sup-n">✗</span> | <span class="sup-y">✓</span> | <span class="sup-y">✓</span> | <span class="sup-n">✗</span> | <span class="sup-y">✓</span> |
| `deployments.send.proveout` 下发试制版本 | <span class="sup-n">✗</span> | <span class="sup-n">✗</span> | <span class="sup-y">✓</span> | <span class="sup-n">✗</span> | <span class="sup-y">✓</span> |
| `drift.disposition` 处置机边修改 | <span class="sup-n">✗</span> | <span class="sup-n">✗</span> | <span class="sup-y">✓</span> | <span class="sup-n">✗</span> | <span class="sup-y">✓</span> |
| `machines.read` 查阅机台与文件状态 | <span class="sup-y">✓</span> | <span class="sup-y">✓</span> | <span class="sup-y">✓</span> | <span class="sup-y">✓</span> | <span class="sup-y">✓</span> |
| `machines.files.restore` 还原快照 | <span class="sup-n">✗</span> | <span class="sup-n">✗</span> | <span class="sup-y">✓</span> | <span class="sup-n">✗</span> | <span class="sup-y">✓</span> |
| `machines.files.adopt` 采纳未受管文件 | <span class="sup-n">✗</span> | <span class="sup-n">✗</span> | <span class="sup-y">✓</span> | <span class="sup-n">✗</span> | <span class="sup-y">✓</span> |
| `admin` 用户、令牌、Webhook、审计 | <span class="sup-n">✗</span> | <span class="sup-n">✗</span> | <span class="sup-n">✗</span> | <span class="sup-n">✗</span> | <span class="sup-y">✓</span> |

ᵃ 具备完整读权限 `programs.read` 的角色隐含具备仅读已发布版本的能力。

## 6.1.4 角色职责 {#personas}

五个角色的对应岗位与职责范围按表 6-3 的规定。

<p class="tbl-caption">表 6-3　角色职责</p>

| 角色 | 对应岗位 | 职责范围 |
| --- | --- | --- |
| 只读 | 生产计划、班组长 | 查阅程序与机台，不可查阅正文，不可执行任何变更 |
| 操作工 | 车间工位 | 查阅已发布版本，向本机组机床下发正式版本，不可查阅正文 |
| 编程员 | 工艺工程师 | 编写程序、提交审批、下发（含试制）、处置机边修改、还原快照与采纳文件 |
| 审批员 | 工艺主管、质量工程师 | 查阅正文、批准或驳回。不可编写，不可下发 |
| 管理员 | 系统管理员 | 上述全部，另含用户、令牌、Webhook 与审计管理 |

:::caution[注意]
编程员不具备批准权限，审批员不具备下发权限，二者构成职责分离的基本结构。
管理员同时具备两类权限，因此生产环境中的管理员账号数量应尽量少，且不应用于日常操作。
:::

## 6.1.5 授权范围 {#scopes}

每条授权由「角色 × 范围」构成，范围类型按表 6-4 的规定。

<p class="tbl-caption">表 6-4　授权范围类型</p>

| 范围 | 作用对象 |
| --- | --- |
| 全局 | 全部对象 |
| 机组 | 该机组内的机台，及与之相关的下发、机边修改处置、快照操作 |
| 程序库 | 该程序库内的程序、版本与审批 |

一名用户可持有多条授权，其有效权限为各条授权的并集。

![用户与授权](/img/console/admin-users.png)

<p class="shot-caption">图 6-1　用户与授权页面</p>

### 6.1.5.1 判定示例 {#examples}

以赵莉为例，其授权为「编程员 · 试制程序库」与「编程员 · 钻攻中心组」两条，
各项操作的判定结果按表 6-5 的规定。

<p class="tbl-caption">表 6-5　授权判定示例</p>

| 操作 | 判定结果 | 原因 |
| --- | :---: | --- |
| 在试制程序库上传新版本 | <span class="sup-y">✓</span> | 程序库范围覆盖 |
| 在量产程序库上传新版本 | <span class="sup-n">✗</span> | 范围不覆盖，返回 403 |
| 将试制库的程序下发至钻攻 01 | <span class="sup-y">✓</span> | 机组范围覆盖 |
| 将试制库的程序下发至立加 01（加工中心组） | <span class="sup-n">✗</span> | 机组范围不覆盖，返回 403 |
| 处置钻攻 01 上的机边修改 | <span class="sup-y">✓</span> | 机组范围覆盖 |
| 批准本人创建的版本 | <span class="sup-n">✗</span> | 不具备 `approvals.decide` |

## 6.1.6 与审批策略的关系 {#vs-policy}

访问控制决定操作是否被允许，程序库审批策略决定放行所需的人数。两者相互独立：

a) 具备 `approvals.decide` 但程序库要求 2 人审批时，单次批准仅计一票；

b) 程序库启用「禁止自审自批」时，即使具备权限，作者本人的批准也不计入。

审批策略的配置见 [5.2](/guide/approvals/#policy)。

## 6.1.7 服务令牌 {#tokens}

服务令牌适用与人员账号完全相同的角色与范围模型。令牌特有的两项属性
（可代理身份、高危需操作人）见 [5.9](/guide/admin/#tokens)。

## 6.1.8 权限相关错误码 {#errors}

<p class="tbl-caption">表 6-6　权限相关错误码</p>

| 状态码 | 含义 | 排查方向 |
| --- | --- | --- |
| 403 | 当前角色或范围不覆盖该目标对象 | 检查用户的授权范围 |
| 409 | 权限满足，但对象当前的生命周期状态不允许该操作，例如下发草稿版本 | 检查对象状态 |
