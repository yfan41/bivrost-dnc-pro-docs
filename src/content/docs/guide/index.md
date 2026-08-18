---
title: "五、日常使用"
description: 按角色和场景组织的操作指南
---

装好、接好之后，日常在这套系统里发生的事就是下面这些。

## 按角色找 {#by-role}

| 你是 | 常做的事 |
| --- | --- |
| **工艺工程师**（编程员） | [上传新版本](/guide/vault/) · [提交审批](/guide/approvals/) · [绑定机台](/guide/assignments/) · [下发](/guide/transfer/) · [处置机边修改](/guide/drift/) |
| **工艺主管**（审批员） | [审阅差异并批准/驳回](/guide/approvals/) |
| **操作工** | [在机边操作台确认版本、按需下发](/guide/shopfloor/) |
| **设备管理** | [网关与机台](/start/gateways/) · [滚动镜像与快照](/guide/mirror/) |
| **系统管理员** | [用户、令牌、Webhook、审计](/guide/admin/) |

## 按场景找 {#by-scenario}

| 场景 | 去哪 |
| --- | --- |
| 程序改了，要发新版 | [程序库与版本](/guide/vault/) → [审批与放行](/guide/approvals/) |
| 新机床上线，要把程序铺过去 | [机台分配与落地转换](/guide/assignments/) |
| 下发失败了，机床上现在是什么 | [程序下发](/guide/transfer/#failure) |
| 新品要试切，怕留在机床上 | [试制（试切）](/guide/trials/) |
| 操作工在机床上改了程序 | [机边修改的处置](/guide/drift/) |
| 机床控制器被清空了 | [滚动镜像与快照](/guide/mirror/#restore) |
| 机床上有一堆没人管的老程序 | [滚动镜像与快照](/guide/mirror/#adopt) |
| 要回答"这批活用的哪一版" | [管理与审计](/guide/admin/#audit) |
| MES / CAM 要对接 | [管理与审计](/guide/admin/#tokens) → [REST API](/reference/api/) |
