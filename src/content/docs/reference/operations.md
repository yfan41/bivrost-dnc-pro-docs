---
title: "6.4. 运维手册"
description: 探针、备份与恢复、升级、日志、容量与调优
---

## 健康探针 {#probes}

| 探针 | 断言 | 用途 |
| --- | --- | --- |
| `GET /healthz` | 仅存活 | 容器重启策略 |
| `GET /readyz` | Postgres 可达 + 结构已迁移 + **blob 存储可写** | 监控告警、负载均衡摘除 |

`/readyz` 失败时返回 **503** 并给出逐项明细：

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

:::danger[把 blob-store 纳入告警]
blob 存储不可写时，**界面完全正常，但每一次程序上传和每一次镜像捕获都会静默失败**。
这是换卷或改权限之后最容易出现、也最难被发现的故障。
:::

建议的监控项：

| 项 | 阈值 |
| --- | --- |
| `/readyz` 非 200 | 立即告警 |
| `dashboard.summary.gatewaysUnreachable > 0` | 15 分钟内未恢复则告警 |
| `dashboard.summary.machinesWithMirrorError > 0` | 1 小时内未恢复则告警 |
| `dashboard.summary.failedDeployments24h` | 按车间基线设阈值 |
| 磁盘剩余空间 | < 20% 告警（备份卷单独看） |

## 备份 {#backup}

`backup` 服务按 `DNCPRO_BACKUP_CRON`（默认每天 02:30）执行：

1. `pg_dump` 整库
2. 归档 blob 存储（程序内容与全部快照）
3. 清理超过 `DNCPRO_BACKUP_RETAIN_DAYS`（默认 30 天）的旧备份

输出写入 `backups` 卷。**请把这个卷同步到 DNC Pro 主机之外的地方**——
主机整机故障时，卷跟着一起没了。

### 恢复到全新主机 {#restore}

```bash
docker compose up -d postgres
docker compose cp <备份目录>/dncpro.dump postgres:/tmp/
docker compose exec postgres pg_restore -U dncpro -d dncpro --clean /tmp/dncpro.dump
docker run --rm -v dncpro_blobs:/data/blobs -v <备份目录>:/backup alpine \
  tar -xzf /backup/blobs.tar.gz -C /data
docker compose up -d
```

恢复后**先跑 `/readyz`**，再逐台核对机台的"最近校验"是否开始更新。

### 恢复一台被清空的机床 {#restore-machine}

DNC Pro 本身完好时：

1. 设备 → 机台 → 文件，逐个文件点**快照 → 还原**
2. 受管文件也可以直接重新[下发](/guide/transfer/)最新已发布版本

## 升级 {#upgrade}

```bash
git pull && cd docker
docker compose build && docker compose up -d
```

- 数据库结构迁移在启动时通过**咨询锁**自动完成，`api` 与 `worker` 可任意顺序启动
- 升级期间正在排队的传输任务会在 `worker` 重启后继续
- **升级前先做一次手动备份**

## 日志 {#logs}

```bash
docker compose logs -f api      # HTTP、认证、迁移、启动引导
docker compose logs -f worker   # 传输执行、镜像扫描、Webhook 投递、试制到期
```

:::note
镜像失败**不只写日志**——它会被记录到对应机床上并显示在控制台。
不要靠翻日志发现备份问题。
:::

## 可调项 {#tuning}

以环境变量传给 `worker`（双下划线代表配置层级）：

| 变量 | 默认 | 说明 |
| --- | --- | --- |
| `DncPro__Mirror__Enabled` | `true` | 关掉滚动镜像（**会同时失去备份与机边修改检测**） |
| `DncPro__Mirror__InterRequestDelayMs` | `250` | 镜像请求之间的节流间隔 |
| `DncPro__Mirror__IdleDelaySeconds` | `5` | 扫完一轮后的休眠时间 |
| `DncPro__Worker__TrialSweepSeconds` | `60` | 试制到期扫描间隔 |

调优建议：

- **网关 CPU 吃紧**：加大 `InterRequestDelayMs`（例如 500–1000）
- **机队很大、希望一轮扫得快些**：减小 `IdleDelaySeconds`，谨慎减小节流间隔
- **不要为了"快"关掉镜像**——那等于关掉这套系统的一半价值

## 容量 {#capacity}

| 规模 | 建议 |
| --- | --- |
| ≤ 30 台机床 | 4 GB 内存、2 vCPU |
| 30–100 台 | 8 GB 内存、4 vCPU |
| > 100 台 | 分车间部署多套，或联系我们评估 |

存储：程序内容按内容哈希去重，一个 30 台机床的车间通常几十 MB 到几百 MB；
Postgres 的增长主要来自审计日志和快照元数据，年增量通常在 GB 以内。

## 安全建议 {#security}

- 生产环境把 DNC Pro 放在**反向代理后面并启用 HTTPS**
- 首次登录后立刻改掉引导管理员密码，并从 `.env` 移除
  `DNCPRO__Bootstrap__AdminPassword`
- 管理员账号应当很少并且**不日常使用**——日常用编程员/审批员账号
- 集成一律用[服务令牌](/guide/admin/#tokens)，按最小范围授权，设置有效期
- 网关侧为 DNC Pro 建**专用账号 + 密钥**，不要复用管理员

## 定期核查清单 {#checklist}

每月一次，15 分钟：

- [ ] `/readyz` 三项全绿
- [ ] 总览页：不可达网关 = 0、镜像异常机台 = 0
- [ ] 设备页：所有机床的"最近校验"都在近期
- [ ] 管理 → 审计 → **校验哈希链**：完整
- [ ] 管理 → Webhook → 投递记录：没有长期积压的失败
- [ ] 备份卷里有近 30 天的备份，且已同步到异地
- [ ] 用户列表：离职人员已停用，令牌无过期未清理的
