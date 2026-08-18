---
title: "5 操作说明"
description: 本章导言，给出按角色与按场景的条款索引
---

本章规定 DNC Pro 系统投入使用后的日常操作方法。各节的编排顺序与程序的实际流转顺序一致：
程序库与版本（5.1）→ 审批与放行（5.2）→ 机台分配（5.3）→ 程序下发（5.4），
其余各节为在此主线上展开的专项操作。

安装与初始配置见第 4 章；角色、权限、机床差异与接口定义见第 6 章。

## 5.0.1 按角色索引 {#by-role}

<p class="tbl-caption">表 5-1　按角色索引</p>

| 岗位（系统角色） | 承担的操作 | 相关条款 |
| --- | --- | --- |
| 工艺工程师（编程员） | 上传版本、提交审批、绑定机台、下发、处置机边修改 | [5.1](/guide/vault/)、[5.2](/guide/approvals/)、[5.3](/guide/assignments/)、[5.4](/guide/transfer/)、[5.7](/guide/drift/) |
| 工艺主管（审批员） | 审阅版本差异，批准或驳回 | [5.2](/guide/approvals/) |
| 操作工 | 在机边操作台核对版本并按需下发 | [5.8](/guide/shopfloor/) |
| 设备管理人员 | 维护网关与机台台账，监视滚动镜像 | [4.2](/start/gateways/)、[5.6](/guide/mirror/) |
| 系统管理员 | 用户与授权、服务令牌、Webhook、审计核查 | [5.9](/guide/admin/) |

## 5.0.2 按场景索引 {#by-scenario}

<p class="tbl-caption">表 5-2　按场景索引</p>

| 场景 | 相关条款 |
| --- | --- |
| 程序内容变更，需发布新版本 | [5.1](/guide/vault/) → [5.2](/guide/approvals/) |
| 新机床上线，需建立程序与机台的对应关系 | [5.3](/guide/assignments/) |
| 下发失败，需确认机床上的实际内容 | [5.4](/guide/transfer/#failure) |
| 新品试制，需限制程序在机床上的留存时间 | [5.5](/guide/trials/) |
| 操作工在机床侧修改了程序 | [5.7](/guide/drift/) |
| 机床控制器数据丢失，需还原程序 | [5.6](/guide/mirror/#restore) |
| 机床上存在大量未纳入管理的历史程序 | [5.6](/guide/mirror/#adopt) |
| 需回答某批零件使用的程序版本与审批人 | [5.9](/guide/admin/#audit) |
| 与 MES、CAM 等上层系统对接 | [5.9](/guide/admin/#tokens) → [6.3](/reference/api/) |
