---
title: "一、DNC Pro 是什么"
hero:
  title: DNC Pro
  tagline: CNC 加工程序的车间级唯一可信源——受控版本、事务式下发、全天候镜像备份与完整审计
  actions:
    - text: 快速上手
      link: start/
      icon: rocket
    - text: 先看它解决什么问题
      link: why/
      variant: minimal
      icon: right-arrow
---

<div class="home-grid not-content">
  <a class="home-card" href="start/install/">
    <span class="home-card-title">安装部署</span>
    <span class="home-card-desc">一条 compose 命令装完整套</span>
  </a>
  <a class="home-card" href="start/gateways/">
    <span class="home-card-title">接入网关</span>
    <span class="home-card-desc">连上彼络网关，同步机台台账</span>
  </a>
  <a class="home-card" href="guide/vault/">
    <span class="home-card-title">程序库与版本</span>
    <span class="home-card-desc">草稿 → 待审批 → 已发布 → 废弃</span>
  </a>
  <a class="home-card" href="guide/transfer/">
    <span class="home-card-title">程序下发</span>
    <span class="home-card-desc">回读校验通过才算下发成功</span>
  </a>
  <a class="home-card" href="guide/drift/">
    <span class="home-card-title">机边修改</span>
    <span class="home-card-desc">操作工改了程序，绝不悄悄覆盖</span>
  </a>
  <a class="home-card" href="reference/api/">
    <span class="home-card-title">REST API</span>
    <span class="home-card-desc">界面能做的，接口都能做</span>
  </a>
</div>

DNC Pro 是一套**部署在你自己车间里**的 CNC 加工程序管理系统。它架在一台或多台
[彼络物联网关](https://docs.bivrost.cn/gateway/)之上，把"哪个零件、哪道工序、该用哪一版程序、
现在机床上跑的到底是不是那一版"这件事，从班组长的记忆和共享文件夹里，搬到一个可查询、可审批、
可追溯的系统中。

![DNC Pro 总览页](/img/console/dashboard.png)

<p class="shot-caption">总览页：待审批、机边修改、试制、失败传输、网关健康——车间当班需要盯的全在一屏</p>

## 六条主线 {#pillars}

| 能力 | 一句话 |
| --- | --- |
| **[程序库](/guide/vault/)** | 程序按版本管理，走「草稿 → 待审批 → 已发布 → 废弃」的生命周期；内容哈希去重，任意两版可并排比对 |
| **[事务式下发](/guide/transfer/)** | 快照 → 删除 → 发送 → 回读 → 校验；任一步失败自动回滚快照。**只有回读内容与发送内容一致，才记为下发成功** |
| **[试制](/guide/trials/)** | 试切是显式、限时的操作，在所有界面上带徽标；到期后由人决定转正还是撤回，系统从不自动改机床 |
| **[滚动镜像](/guide/mirror/)** | 全天候滚动备份每台机床上的每个文件；机边修改被自动捕获成待处置版本，**绝不悄悄还原** |
| **[权限](/reference/rbac/)** | 固定角色（管理员/编程员/审批员/操作工/只读）× 授权范围（机组、程序库）；本地账号可完全离网，也可接 OIDC 单点登录 |
| **[审计](/guide/admin/#audit)** | 只增不改的哈希链日志，记录每一次状态变更和每一次程序内容外流，支持查询、CSV 导出与链完整性校验 |

## 两个界面，一套 API {#surfaces}

DNC Pro 提供两个前端，它们都是同一套 REST API 的客户端——**没有私有接口**：

- **管理控制台**（`http://<主机>:8030/`）：工艺、质量、设备管理人员用。程序库、审批、设备、
  传输记录、试制、机边修改、系统管理。
- **[机边操作台](/guide/shopfloor/)**（`http://<主机>:8030/shopfloor/`）：车间工位的触摸屏用。
  大按钮、少文字，只显示当前操作工权限范围内的机台和它们该用的程序。

![机边操作台](/img/shopfloor/machine.png)

<p class="shot-caption">机边操作台：操作工只看得到自己机组的机台，和这台机床该跑的那几个程序</p>

## 它不做什么 {#non-goals}

说清楚边界，比堆功能更有用：

- **不采集加工数据。** 产量、OEE、报警、刀具寿命由彼络网关和上层系统负责，DNC Pro 只管程序。
- **不替人做决定。** 到期的试切不会自动撤回，机床上被改过的程序不会被自动覆盖，
  两者都停在界面上等工程师处置。
- **不上云。** 整套系统跑在你的局域网里，可以完全断网运行（本地账号 + 本地 Postgres + 本地文件存储）。

## 关于本手册中的截图 {#screenshots}

本手册所有截图来自一套**演示数据集**：两台车间网关、10 台不同系统的机床、
三个程序库、六名不同角色的人员，以及一批真实跑通的下发、试切与机边修改记录。
零件号、程序名、人员姓名均为示例，与任何真实客户无关。

复现方法见[快速上手](/start/)。
