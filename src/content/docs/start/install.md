---
title: "4.1 安装部署"
description: 规定 docker compose 部署步骤、环境变量配置、就绪判定、备份恢复与升级方法
---

## 4.1.1 适用范围 {#scope}

本节规定 DNC Pro 系统的安装、就绪确认、备份恢复与升级方法。适用于具备主机 root 权限的
IT 人员。

本系统以 docker-compose 栈交付，仅支持 Linux 主机。使用单位提供一台 Linux 虚拟机或物理机，
其余组件由本系统自带。

## 4.1.2 前置条件 {#prerequisites}

a) 主机为 Linux x86-64，已安装 Docker Engine 24 或更高版本及 compose v2；

b) 主机具备固定 IP 或 DNS 名称；

c) `8030` 端口（或计划使用的其他端口）未被占用。

## 4.1.3 首次安装 {#first-install}

操作步骤：

```bash
git clone <分发源> dnc-pro && cd dnc-pro/docker
cp .env.example .env         # 必填 POSTGRES_PASSWORD；端口与备份计划按需调整
docker compose up -d --build
docker compose logs api | grep admin
```

`.env` 中可配置的变量按表 4-2 的规定。

<p class="tbl-caption">表 4-2　环境变量</p>

| 变量 | 默认值 | 说明 |
| --- | --- | --- |
| `POSTGRES_PASSWORD` | 无，必填 | 数据库密码 |
| `DNCPRO_PORT` | `8030` | 对外暴露的 HTTP 端口 |
| `DNCPRO_BACKUP_CRON` | `30 2 * * *` | 备份计划，默认每日 02:30 |
| `DNCPRO_BACKUP_RETAIN_DAYS` | `30` | 备份保留天数 |
| `DNCPRO__Bootstrap__AdminPassword` | 未设置 | 设定后作为首个管理员密码；未设定时随机生成 |

## 4.1.4 首个管理员密码 {#bootstrap-admin}

首次启动时，若数据库中不存在任何用户，API 服务将创建 `admin` 账号，其密码按下列规则确定：

a) `DNCPRO__Bootstrap__AdminPassword` 未设置时，随机生成密码，并在 API 日志中打印一次，
   即 4.1.3 中 `grep admin` 抓取的行；

b) 已设置时直接采用该值，日志不打印密码。

:::danger[警告]
随机密码仅出现在该次启动日志中，日志轮转后不可恢复。应先记录该密码再继续后续步骤，
登录后立即经「右上角账户菜单 → 修改密码」更换。
生产环境应在首次登录后将 `DNCPRO__Bootstrap__AdminPassword` 从 `.env` 中移除。
:::

打开 `http://<主机>:8030` 进入登录页面。

![登录页](/img/console/login.png)

<p class="shot-caption">图 4-1　管理控制台登录页面</p>

## 4.1.5 就绪确认 {#readyz}

页面可打开仅表明进程存活，不表明系统就绪。应按下列方法确认就绪状态。

操作步骤：

```bash
curl -fsS http://<主机>:8030/readyz | jq
```

正常输出如下：

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

两个探针的分工按表 4-3 的规定。

<p class="tbl-caption">表 4-3　健康探针</p>

| 探针 | 断言内容 | 用途 |
| --- | --- | --- |
| `/healthz` | 仅断言进程存活 | 容器与进程重启策略 |
| `/readyz` | 断言 Postgres 可达、数据库结构已迁移、blob 存储可写；任一项失败返回 503 并给出逐项明细 | 监控告警、负载均衡摘除 |

:::danger[警告]
blob 存储不可写（多见于更换存储卷或调整目录权限之后）时，界面显示一切正常，
但每一次程序上传与每一次镜像捕获都会静默失败。上线前应确认 `blob-store` 状态为 `ok`。
:::

## 4.1.6 备份 {#backup}

`backup` 服务按 `DNCPRO_BACKUP_CRON` 定时执行 `pg_dump` 并归档程序内容，写入 `backups` 卷。
超过 `DNCPRO_BACKUP_RETAIN_DAYS` 的备份自动清理。

恢复至一台全新主机的操作步骤：

```bash
docker compose up -d postgres
docker compose cp <备份目录>/dncpro.dump postgres:/tmp/
docker compose exec postgres pg_restore -U dncpro -d dncpro --clean /tmp/dncpro.dump
docker run --rm -v dncpro_blobs:/data/blobs -v <备份目录>:/backup alpine \
  tar -xzf /backup/blobs.tar.gz -C /data
docker compose up -d
```

机台文件的历史（镜像快照）随数据库与 blob 存储一并恢复。
将被清空的 CNC 控制器恢复至原有内容的操作在本系统界面上执行
（设备 → 机台 → 文件 → 还原快照），见 [5.6](/guide/mirror/#restore)。

## 4.1.7 升级 {#upgrade}

操作步骤：

```bash
git pull && cd docker
docker compose build && docker compose up -d
```

数据库结构迁移在启动时经咨询锁自动完成，`api` 与 `worker` 服务可按任意顺序启动。

## 4.1.8 端口与访问地址 {#ports}

<p class="tbl-caption">表 4-4　访问地址</p>

| 地址 | 用途 |
| --- | --- |
| `http://<主机>:8030/` | 管理控制台 |
| `http://<主机>:8030/shopfloor/` | 机边操作台（车间触摸屏） |
| `http://<主机>:8030/api/docs` | REST API 交互式参考 |
| `http://<主机>:8030/openapi/v1.json` | OpenAPI 3.1 文档 |
| `http://<主机>:8030/healthz`、`/readyz` | 存活探针、就绪探针 |

安装完成后按 [4.2](/start/gateways/) 接入网关与机台。
