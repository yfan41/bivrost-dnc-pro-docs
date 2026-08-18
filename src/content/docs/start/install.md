---
title: "4.1. 安装部署"
description: docker compose 部署 DNC Pro，并确认它真的就绪
---

DNC Pro 以 docker-compose 栈交付，**只支持 Linux 主机**。
你提供一台 Linux 虚拟机或物理机，其余由 DNC Pro 自带。

## 首次安装 {#first-install}

```bash
git clone <你的分发源> dnc-pro && cd dnc-pro/docker
cp .env.example .env         # 必填 POSTGRES_PASSWORD；端口与备份计划按需调整
docker compose up -d --build
docker compose logs api | grep admin
```

`.env` 里可配置的项：

| 变量 | 默认 | 说明 |
| --- | --- | --- |
| `POSTGRES_PASSWORD` | 无，**必填** | 数据库密码 |
| `DNCPRO_PORT` | `8030` | 对外暴露的 HTTP 端口 |
| `DNCPRO_BACKUP_CRON` | `30 2 * * *` | 备份计划（默认每天 02:30） |
| `DNCPRO_BACKUP_RETAIN_DAYS` | `30` | 备份保留天数 |
| `DNCPRO__Bootstrap__AdminPassword` | 未设置 | 设了就用它作为首个管理员密码；不设则随机生成 |

## 第一个管理员密码 {#bootstrap-admin}

首次启动时，如果数据库里一个用户都没有，API 会创建 `admin` 账号。

- 若 `DNCPRO__Bootstrap__AdminPassword` **未设置**：随机生成一个密码，
  在 API 日志里**只打印一次**（就是上面那条 `grep admin` 抓的行）。
- 若已设置：直接用它，日志不打印密码。

:::caution
随机密码只出现在那一次的日志里。**先记下来再继续**，然后登录后立刻在
右上角账户菜单 →「修改密码」里换掉。生产环境请在首次登录后把
`DNCPRO__Bootstrap__AdminPassword` 从 `.env` 中移除。
:::

打开 `http://<主机>:8030`：

![登录页](/img/console/login.png)

## 确认它真的就绪 {#readyz}

装完不要只看页面能打开——那只能说明进程活着。

```bash
curl -fsS http://<主机>:8030/readyz | jq
```

```json
{
  "status": "ready",
  "checks": [
    { "name": "database",   "status": "ok", "detail": null },
    { "name": "migrations", "status": "ok", "detail": null },
    { "name": "blob-store", "status": "ok", "detail": null }
  ]
}
```

两个探针的分工：

| 探针 | 断言什么 | 用在哪 |
| --- | --- | --- |
| `/healthz` | **仅存活**。进程起来了就返回 `ok` | 容器/进程重启策略 |
| `/readyz` | Postgres 可达、结构已迁移、**blob 存储可写**；任一失败返回 **503** 并给出逐项明细 | 监控告警、负载均衡摘除 |

:::danger[最值得盯的一项是 blob-store]
如果 blob 存储不可写（换卷、改权限之后最容易出现），
**界面看起来一切正常，但每一次程序上传和每一次镜像捕获都会静默失败**。
上线前务必确认这里是 `ok`。
:::

## 备份 {#backup}

`backup` 服务按 `DNCPRO_BACKUP_CRON` 定时执行 `pg_dump` 加程序内容归档，
写入 `backups` 卷，超过 `DNCPRO_BACKUP_RETAIN_DAYS` 的自动清理。

灾难恢复到一台全新主机：

```bash
docker compose up -d postgres
docker compose cp <备份目录>/dncpro.dump postgres:/tmp/
docker compose exec postgres pg_restore -U dncpro -d dncpro --clean /tmp/dncpro.dump
docker run --rm -v dncpro_blobs:/data/blobs -v <备份目录>:/backup alpine \
  tar -xzf /backup/blobs.tar.gz -C /data
docker compose up -d
```

机台文件的历史（镜像快照）随数据库 + blob 存储一并恢复；
之后要把某台被清空的 CNC 控制器恢复回去，在 DNC Pro 界面上做
（设备 → 机台 → 文件 → 还原快照）。

## 升级 {#upgrade}

```bash
git pull && cd docker
docker compose build && docker compose up -d
```

数据库结构迁移在启动时通过咨询锁自动完成，`api` 与 `worker` 可任意顺序启动。

## 端口与访问 {#ports}

| 地址 | 用途 |
| --- | --- |
| `http://<主机>:8030/` | 管理控制台 |
| `http://<主机>:8030/shopfloor/` | 机边操作台（车间触摸屏） |
| `http://<主机>:8030/api/docs` | REST API 交互式参考 |
| `http://<主机>:8030/openapi/v1.json` | OpenAPI 3.1 文档 |
| `http://<主机>:8030/healthz` · `/readyz` | 存活 / 就绪探针 |

下一步：[接入网关与机台](/start/gateways/)。
