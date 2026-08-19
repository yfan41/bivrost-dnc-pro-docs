---
title: "1 概述"
hero:
  title: DNC Pro
  tagline: CNC 加工程序的车间级唯一可信源——受控版本、事务式下发、全天候镜像备份与完整审计
  actions:
    - text: 快速上手
      link: start/
      icon: rocket
    - text: 安全与注意事项
      link: safety/
      variant: minimal
      icon: right-arrow
---

<div class="home-grid not-content">
  <a class="home-card" href="safety/">
    <span class="home-card-title">安全与注意事项</span>
    <span class="home-card-desc">使用前必读的强制性要求</span>
  </a>
  <a class="home-card" href="start/gateways/">
    <span class="home-card-title">4.1 接入网关与机台</span>
    <span class="home-card-desc">注册网关、同步机台台账、划分机组</span>
  </a>
  <a class="home-card" href="start/first-transfer/">
    <span class="home-card-title">4.2 首次程序下发</span>
    <span class="home-card-desc">建立程序库、审批放行、执行下发</span>
  </a>
  <a class="home-card" href="guide/vault/">
    <span class="home-card-title">5.1 程序库与版本</span>
    <span class="home-card-desc">草稿 → 待审批 → 已发布 → 废弃</span>
  </a>
  <a class="home-card" href="guide/transfer/">
    <span class="home-card-title">5.4 程序下发</span>
    <span class="home-card-desc">六阶段事务与失败回滚</span>
  </a>
  <a class="home-card" href="reference/api/">
    <span class="home-card-title">6.3 REST API</span>
    <span class="home-card-desc">认证、错误约定、端点总览</span>
  </a>
</div>

## 1.1 编写目的 {#purpose}

本说明书规定 DNC Pro 数控程序管理系统的接入配置方法、操作方法、参考资料与故障处置措施，
作为该系统的随机技术文件使用。

## 1.2 适用读者 {#audience}

本说明书适用于使用单位的系统管理员、工艺工程师、工艺主管、设备管理人员与
数控机床操作人员。各岗位对应的条款索引见 [5 章导言](/guide/)。

## 1.3 文档约定 {#conventions}

**章节编号。** 正文按第 1 章至第 7 章编号，条款采用 `章.节.条` 三级编号，例如 5.4.3。
「安全与注意事项」与「修订记录」为不编号的前置章与后置章。

**图表编号。** 图与表按章编号，格式为 `图 章-序号`、`表 章-序号`，例如图 5-4、表 5-13。
图题置于图下方，表题置于表上方。交叉引用采用「见图 5-4」「见表 5-13」「见 5.4.3」的形式。

**提示分级。** 全书使用警告、注意、说明三级提示，其含义与使用场合见
[安全与注意事项](/safety/#levels)。

**术语。** 全书术语以 [6.5 术语表](/reference/glossary/)为准。同一概念只使用一种称谓，
规范用词与不推荐用词的对照见表 6-17。

**界面元素。** 界面上的按钮、菜单、字段名以「」标注，例如单击「下发」。
命令、路径、请求头、权限码等以等宽字体标注，例如 `deployments.send.released`。

## 1.4 系统简介 {#intro}

DNC Pro 是运行于使用单位车间局域网内的 CNC 加工程序管理系统。它架设于一台或多台
[彼络物联网关](https://docs.bivrost.cn/gateway/)之上，将零件、工序、程序版本与机床上
实际内容之间的对应关系，由人工记忆与共享文件夹转为可查询、可审批、可追溯的系统记录。

![DNC Pro 总览页](/img/console/dashboard.png)

<p class="shot-caption">图 1-1　管理控制台总览页面</p>

总览页集中显示当班需关注的项目：待审批版本、机边修改、进行中的试制、失败传输与网关健康状态。

## 1.5 功能构成 {#pillars}

本系统的功能按表 1-1 的规定构成六条主线。

<p class="tbl-caption">表 1-1　功能构成</p>

| 功能 | 说明 | 条款 |
| --- | --- | --- |
| 程序库与版本 | 程序按版本管理，经「草稿 → 待审批 → 已发布 → 废弃」流转；内容按哈希去重，任意两版可并排比对 | [5.1](/guide/vault/) |
| 事务式下发 | 预检 → 快照 → 删除 → 发送 → 回读 → 校验；任一阶段失败自动回滚快照。仅在回读内容与发送内容一致时判定为成功 | [5.4](/guide/transfer/) |
| 试制 | 显式的限时操作，全部界面带徽标；到期后由人员决定转正或撤回，系统不自动改动机床 | [5.5](/guide/trials/) |
| 滚动镜像 | 全天候备份每台机床上的每个文件；机边修改被自动捕获为待处置版本，系统不自动还原 | [5.6](/guide/mirror/) |
| 角色与权限 | 五个固定角色（管理员、编程员、审批员、操作工、只读）× 授权范围（机组、程序库）；本地账号可完全离网，亦可对接 OIDC 单点登录 | [6.1](/reference/rbac/) |
| 审计 | 只增不改的哈希链日志，记录每一次状态变更与每一次程序内容外流，支持查询、CSV 导出与链完整性校验 | [5.9](/guide/admin/#audit) |

## 1.6 界面构成 {#surfaces}

本系统提供两个前端，二者均为同一套 REST API 的客户端，不存在未公开接口。
界面构成按表 1-2 的规定。

<p class="tbl-caption">表 1-2　界面构成</p>

| 界面 | 访问地址 | 使用人员 | 主要内容 |
| --- | --- | --- | --- |
| 管理控制台 | `http://<主机>:8030/` | 工艺、质量、设备管理人员 | 程序库、审批、设备、传输记录、试制、机边修改、系统管理 |
| 机边操作台 | `http://<主机>:8030/shopfloor/` | 车间工位操作人员 | 授权范围内的机台及其应运行的程序 |

![机边操作台](/img/shopfloor/machine.png)

<p class="shot-caption">图 1-2　机边操作台的机台页面</p>

机边操作台仅显示当前操作工授权范围内的机台，以及该机台应当运行的程序，
详见 [5.8](/guide/shopfloor/)。

## 1.7 不适用范围 {#non-goals}

本系统不提供下列功能，相关需求应由其他系统承担：

a) **不采集加工数据。** 产量、OEE、报警与刀具寿命由彼络物联网关及上层系统负责，
   本系统仅管理加工程序；

b) **不代替人员决策。** 到期的试制不会被自动撤回，机床上被修改的程序不会被自动覆盖，
   二者均停留在界面上等待人工处置；

c) **不提供云端服务。** 全套系统运行于使用单位的局域网内，全部数据存储于使用单位
   自有服务器，可在完全断网条件下运行。

完整的责任边界见[安全与注意事项](/safety/#scope)。

## 1.8 关于本说明书中的截图 {#screenshots}

本说明书的全部截图取自一套演示数据集，其构成为：两台车间网关、10 台不同控制系统的机床、
三个程序库、六名不同角色的人员，以及一批已执行完成的下发、试制与机边修改记录。

截图中的零件号、程序名与人员姓名均为示例值，与任何实际客户无关。
演示数据集的复现方法见 [4 章导言](/start/#demo-env)。
