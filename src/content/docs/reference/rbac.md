---
title: "6.1. 角色与权限"
description: 五个固定角色、十三项权限的完整矩阵，以及授权范围的计算方式
---

## 设计原则 {#principles}

- **角色是固定的**，不能自定义。五个角色覆盖车间里真实存在的五种职责，
  可自定义的角色系统在实践中总是退化成"每个人一个角色"。
- **范围是可变的**。同一个角色可以只作用在某个机组或某个程序库上。
- **人和令牌用同一套规则**。没有"超级令牌"。

## 权限矩阵 {#matrix}

| 权限 | 只读 | 操作工 | 编程员 | 审批员 | 管理员 |
| --- | :---: | :---: | :---: | :---: | :---: |
| `programs.read` 看程序与元数据 | <span class="sup-y">✓</span> | <span class="sup-n">✗</span> | <span class="sup-y">✓</span> | <span class="sup-y">✓</span> | <span class="sup-y">✓</span> |
| `programs.read.released` 只看已发布版本 | <span class="sup-y">✓</span>* | <span class="sup-y">✓</span> | <span class="sup-y">✓</span>* | <span class="sup-y">✓</span>* | <span class="sup-y">✓</span> |
| `programs.content.view` 看/下载正文 | <span class="sup-n">✗</span> | <span class="sup-n">✗</span> | <span class="sup-y">✓</span> | <span class="sup-y">✓</span> | <span class="sup-y">✓</span> |
| `programs.write` 建程序、传版本、建分配 | <span class="sup-n">✗</span> | <span class="sup-n">✗</span> | <span class="sup-y">✓</span> | <span class="sup-n">✗</span> | <span class="sup-y">✓</span> |
| `versions.submit` 提交审批 | <span class="sup-n">✗</span> | <span class="sup-n">✗</span> | <span class="sup-y">✓</span> | <span class="sup-n">✗</span> | <span class="sup-y">✓</span> |
| `approvals.decide` 批准/驳回 | <span class="sup-n">✗</span> | <span class="sup-n">✗</span> | <span class="sup-n">✗</span> | <span class="sup-y">✓</span> | <span class="sup-y">✓</span> |
| `deployments.send.released` 下发已发布版本 | <span class="sup-n">✗</span> | <span class="sup-y">✓</span> | <span class="sup-y">✓</span> | <span class="sup-n">✗</span> | <span class="sup-y">✓</span> |
| `deployments.send.proveout` 下发试制 | <span class="sup-n">✗</span> | <span class="sup-n">✗</span> | <span class="sup-y">✓</span> | <span class="sup-n">✗</span> | <span class="sup-y">✓</span> |
| `drift.disposition` 处置机边修改 | <span class="sup-n">✗</span> | <span class="sup-n">✗</span> | <span class="sup-y">✓</span> | <span class="sup-n">✗</span> | <span class="sup-y">✓</span> |
| `machines.read` 看机台与文件状态 | <span class="sup-y">✓</span> | <span class="sup-y">✓</span> | <span class="sup-y">✓</span> | <span class="sup-y">✓</span> | <span class="sup-y">✓</span> |
| `machines.files.restore` 还原快照 | <span class="sup-n">✗</span> | <span class="sup-n">✗</span> | <span class="sup-y">✓</span> | <span class="sup-n">✗</span> | <span class="sup-y">✓</span> |
| `machines.files.adopt` 采纳未受管文件 | <span class="sup-n">✗</span> | <span class="sup-n">✗</span> | <span class="sup-y">✓</span> | <span class="sup-n">✗</span> | <span class="sup-y">✓</span> |
| `admin` 用户/令牌/Webhook/审计 | <span class="sup-n">✗</span> | <span class="sup-n">✗</span> | <span class="sup-n">✗</span> | <span class="sup-n">✗</span> | <span class="sup-y">✓</span> |

\* 拥有完整读权限 `programs.read` 的角色隐含具备"只读已发布"的能力。

## 五个角色的画像 {#personas}

| 角色 | 典型岗位 | 一句话 |
| --- | --- | --- |
| **只读** | 生产计划、班组长 | 能看程序和机台，看不到正文，改不了任何东西 |
| **操作工** | 车间工位 | 只看已发布版本，能把正确版本发到自己机组的机床上，看不到正文 |
| **编程员** | 工艺工程师 | 写程序、提交审批、下发（含试制）、处置机边修改、还原与采纳 |
| **审批员** | 工艺主管、质量工程师 | 看正文、批准/驳回。**不能写、不能发** |
| **管理员** | 系统管理员 | 上面全部 + 用户/令牌/Webhook/审计 |

注意**编程员不能批准**、**审批员不能下发**——这是职责分离的骨架。
管理员两者都有，所以生产环境里管理员账号应当很少并且不日常使用。

## 授权范围 {#scopes}

每条授权是 `角色 × 范围`：

| 范围 | 作用对象 |
| --- | --- |
| **全局** | 一切 |
| **机组** | 该机组内的机床，及与之相关的下发、漂移处置、快照操作 |
| **程序库** | 该库内的程序、版本、审批 |

一个人可以有多条授权，权限取**并集**。

![用户与授权](/img/console/admin-users.png)

<p class="shot-caption">赵莉有两条授权：试制程序库的编程员 + 钻攻中心组的编程员</p>

### 判定示例 {#examples}

赵莉（`编程员·试制程序库` + `编程员·钻攻中心组`）：

| 操作 | 结果 |
| --- | --- |
| 在试制程序库上传新版本 | <span class="sup-y">✓</span> |
| 在量产程序库上传新版本 | <span class="sup-n">✗</span> 403 |
| 把试制库的程序下发到钻攻01 | <span class="sup-y">✓</span> |
| 把试制库的程序下发到立加01（加工中心组） | <span class="sup-n">✗</span> 403 |
| 处置钻攻01 上的机边修改 | <span class="sup-y">✓</span> |
| 批准自己写的版本 | <span class="sup-n">✗</span> 没有 `approvals.decide` |

## 与审批策略的关系 {#vs-policy}

RBAC 决定"**能不能**做"，[程序库审批策略](/guide/approvals/#policy)决定"**要几个人**做"。
两者是独立的：

- 有 `approvals.decide` 但库要求 2 人 → 你的批准只算一票
- 库开了"禁止自审自批" → 你即使有权限，也不能批自己写的

## 服务令牌 {#tokens}

令牌用**完全相同**的角色与范围模型。额外两个开关见
[管理与审计 · 服务令牌](/guide/admin/#tokens)。

## 403 与 409 {#errors}

| 状态码 | 含义 |
| --- | --- |
| **403** | 你的角色或范围覆盖不到这个目标 |
| **409** | 权限没问题，但对象当前的生命周期状态不允许这个操作（例如下发一个草稿版本） |

看到 403 时查授权范围；看到 409 时查对象状态。
