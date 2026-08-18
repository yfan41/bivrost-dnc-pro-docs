---
title: "6.4 运行维护"
description: 规定健康探针与监控项、备份与恢复规程、升级方法、日志查阅、可调参数、容量规划与定期核查
---

## 6.4.1 适用范围 {#scope}

本节规定本系统的日常运行维护要求。适用于系统管理员与 IT 运维人员。

## 6.4.2 健康探针 {#probes}

两个探针的分工按表 6-10 的规定。

<p class="tbl-caption">表 6-10　健康探针</p>

| 探针 | 断言内容 | 用途 |
| --- | --- | --- |
| `GET /healthz` | 仅断言进程存活 | 容器重启策略 |
| `GET /readyz` | Postgres 可达、数据库结构已迁移、blob 存储可写 | 监控告警、负载均衡摘除 |

`/readyz` 失败时返回 503 并给出逐项明细：

```json
{
  "status": "not-ready",
  "checks": [
    { "name": "database",   "status": "ok",   "detail": null },
    { "name": "migrations", "status": "ok",   "detail": null },
    { "name": "blob-store", "status": "fail", "detail": "..." }
  ]
}
```

:::danger[警告]
blob 存储不可写时，界面显示完全正常，但每一次程序上传与每一次镜像捕获都会静默失败。
该故障多发于更换存储卷或调整目录权限之后，且不易被察觉，必须纳入监控告警。
:::

## 6.4.3 监控项 {#monitoring}

建议的监控项与阈值按表 6-11 的规定。

<p class="tbl-caption">表 6-11　建议监控项</p>

| 监控项 | 阈值与处理 |
| --- | --- |
| `/readyz` 返回非 200 | 立即告警 |
| `dashboard.summary.gatewaysUnreachable > 0` | 15 分钟内未恢复则告警 |
| `dashboard.summary.machinesWithMirrorError > 0` | 1 小时内未恢复则告警 |
| `dashboard.summary.failedDeployments24h` | 按本车间基线设定阈值 |
| 磁盘剩余空间 | 低于 20% 告警，备份卷单独设定 |

## 6.4.4 备份 {#backup}

`backup` 服务按 `DNCPRO_BACKUP_CRON`（默认每日 02:30）执行下列动作：

a) 对数据库执行 `pg_dump` 全量导出；

b) 归档 blob 存储，含程序内容与全部快照；

c) 清理超过 `DNCPRO_BACKUP_RETAIN_DAYS`（默认 30 天）的历史备份。

输出写入 `backups` 卷。

:::danger[警告]
`backups` 卷与本系统位于同一主机。主机整机故障时该卷同时失效。
应将备份同步至本系统主机之外的存储。
:::

### 6.4.4.1 恢复至全新主机 {#restore}

操作步骤：

```bash
docker compose up -d postgres
docker compose cp <备份目录>/dncpro.dump postgres:/tmp/
docker compose exec postgres pg_restore -U dncpro -d dncpro --clean /tmp/dncpro.dump
docker run --rm -v dncpro_blobs:/data/blobs -v <备份目录>:/backup alpine \
  tar -xzf /backup/blobs.tar.gz -C /data
docker compose up -d
```

恢复后应先执行 `/readyz` 确认三项状态均为 `ok`，再逐台核对机台的「最近校验」是否开始更新。

### 6.4.4.2 恢复被清空的机床 {#restore-machine}

本系统数据完好时，操作步骤：

a) 进入「设备 → 机台 → 文件」，逐个文件执行「快照 → 还原」；

b) 受管文件亦可直接重新下发最新的已发布版本。

还原规则见 [5.6](/guide/mirror/#restore)。

## 6.4.5 升级 {#upgrade}

操作步骤：

```bash
git pull && cd docker
docker compose build && docker compose up -d
```

升级相关规则：

a) 数据库结构迁移在启动时经咨询锁自动完成，`api` 与 `worker` 可按任意顺序启动；

b) 升级期间处于排队状态的传输任务在 `worker` 重启后继续执行。

:::caution[注意]
升级前应执行一次手动备份。
:::

## 6.4.6 日志 {#logs}

```bash
docker compose logs -f api      # HTTP、认证、迁移、启动引导
docker compose logs -f worker   # 传输执行、镜像扫描、Webhook 投递、试制到期
```

:::note[说明]
镜像失败不仅写入日志，同时记录到对应机台并显示在控制台上，见 [5.6](/guide/mirror/#health)。
备份问题的发现不应依赖查阅日志。
:::

## 6.4.7 可调参数 {#tuning}

下列参数以环境变量传入 `worker` 服务，双下划线表示配置层级，取值按表 6-12 的规定。

<p class="tbl-caption">表 6-12　worker 可调参数</p>

| 变量 | 默认值 | 说明 |
| --- | --- | --- |
| `DncPro__Mirror__Enabled` | `true` | 滚动镜像开关 |
| `DncPro__Mirror__InterRequestDelayMs` | `250` | 镜像请求之间的节流间隔 |
| `DncPro__Mirror__IdleDelaySeconds` | `5` | 完成一轮扫描后的休眠时间 |
| `DncPro__Worker__TrialSweepSeconds` | `60` | 试制到期扫描间隔 |

调优要求：

a) 网关 CPU 负载偏高时，增大 `InterRequestDelayMs`，建议取 500～1000；

b) 机队规模较大且需缩短单轮扫描时间时，减小 `IdleDelaySeconds`，节流间隔应谨慎减小。

:::danger[警告]
不应为提升响应速度而关闭滚动镜像。关闭后将同时失去备份能力与机边修改检测能力，
见 [5.6](/guide/mirror/#disable)。
:::

## 6.4.8 容量规划 {#capacity}

<p class="tbl-caption">表 6-13　容量配置建议</p>

| 机队规模 | 内存 | CPU |
| --- | --- | --- |
| 30 台及以下 | 4 GB | 2 vCPU |
| 30～100 台 | 8 GB | 4 vCPU |
| 100 台以上 | 分车间部署多套系统，或由供应方评估 | — |

存储占用：程序内容按内容哈希去重，30 台机床规模的车间通常为数十至数百兆字节。
Postgres 的增长主要来自审计日志与快照元数据，年增量通常在 1 GB 以内。

## 6.4.9 安全要求 {#security}

a) 生产环境应将本系统置于反向代理之后并启用 HTTPS；

b) 首次登录后应立即修改引导管理员密码，并从 `.env` 中移除
   `DNCPRO__Bootstrap__AdminPassword`；

c) 管理员账号数量应尽量少，且不应用于日常操作。日常操作应使用编程员或审批员账号；

d) 集成应一律使用服务令牌，按最小范围授权并设定有效期，见 [5.9](/guide/admin/#tokens)；

e) 网关侧应为本系统建立专用账号与密钥，不应复用网关管理员账号。

## 6.4.10 定期核查 {#checklist}

每月执行一次，按下列各项逐条核查：

a) `/readyz` 三项状态均为 `ok`；

b) 总览页：不可达网关数为 0，镜像异常机台数为 0；

c) 设备页：全部机台的「最近校验」处于近期；

d) 管理 → 审计 → 校验哈希链：结果为完整；

e) 管理 → Webhook → 投递记录：无长期积压的失败投递；

f) 备份卷中存在近 30 天的备份，且已同步至异地；

g) 用户列表：离职人员账号已停用，无过期未清理的服务令牌。
