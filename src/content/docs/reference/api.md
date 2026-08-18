---
title: "6.3 REST API"
description: 规定接口的认证方式、错误响应约定、端点总览、集成示例与版本策略
---

## 6.3.1 适用范围 {#scope}

本节规定本系统对外提供的 REST 接口。适用于与 MES、CAM、看板等上层系统的集成开发。

管理控制台与机边操作台均为本套接口的客户端，不存在未公开接口。界面上可执行的操作，
接口均可执行。

接口文档入口：

a) 交互式参考：`http://<主机>:8030/api/docs`；

b) OpenAPI 3.1 文档：`http://<主机>:8030/openapi/v1.json`。

![API 参考](/img/console/api-docs.png)

<p class="shot-caption">图 6-4　REST API 交互式参考页面</p>

:::note[说明]
每个接口均附摘要、分组标签与错误响应说明。该约束由构建时的测试强制执行，
接口缺少文档时构建失败。
:::

## 6.3.2 认证 {#auth}

### 6.3.2.1 浏览器客户端 {#cookie}

登录请求：

```http
POST /api/v1/auth/login
Content-Type: application/json

{ "username": "lichen", "password": "..." }
```

登录成功后种下会话 Cookie。

:::caution[注意]
所有非 GET 请求必须携带 `X-Requested-With: XMLHttpRequest` 请求头，否则被拒绝。
该头用于 CSRF 防护：XHR 请求可携带该头，跨站表单提交不能。
:::

### 6.3.2.2 机器对机器 {#token}

使用服务令牌（见 [5.9](/guide/admin/#tokens)）：

```http
Authorization: Bearer dncp_<id>_<secret>
```

可另行声明实际操作人，使审计记录可追溯到具体人员：

```http
X-On-Behalf-Of: lichen
```

令牌启用「高危需操作人」时，下发、删除等操作必须携带该请求头，否则拒绝执行。

## 6.3.3 错误约定 {#errors}

失败响应统一返回 RFC 7807 problem document，状态码按表 6-8 的规定。

<p class="tbl-caption">表 6-8　错误状态码</p>

| 状态码 | 含义 | 排查方向 |
| --- | --- | --- |
| 400 | 请求本身不合法 | 检查请求体与参数格式 |
| 401 | 未认证、会话过期或令牌无效 | 检查凭据与有效期 |
| 403 | 角色或授权范围不覆盖目标对象 | 检查授权配置（见 [6.1](/reference/rbac/)） |
| 404 | 对象不存在，或在当前范围内不可见 | 检查对象 ID 与授权范围 |
| 409 | 与对象当前的生命周期状态冲突，例如下发草稿版本 | 检查对象状态 |
| 422 | 请求可被理解，但内容不可接受 | 检查业务约束 |
| 503 | 依赖不可用 | 查询 `/readyz` 定位失败项 |

403 与 409 为集成过程中最常见的两类错误：403 应检查授权，409 应检查对象状态。

## 6.3.4 端点总览 {#endpoints}

<p class="tbl-caption">表 6-9　端点总览</p>

| 分组 | 主要端点 |
| --- | --- |
| Auth | `POST /api/v1/auth/login`、`POST /auth/logout`、`POST /auth/change-password`、`GET /auth/me` |
| Vault | `POST/GET /libraries`、`POST/GET /programs`、`POST/GET /programs/{id}/versions`、`POST /versions/{id}/submit`、`GET /programs/{id}/diff`、`GET /versions/{id}/content`、`POST /versions/{id}/obsolete` |
| Approvals | `GET /approvals`、`POST /approvals/{id}/decide` |
| Fleet | `POST/GET /gateways`、`POST /gateways/{id}/sync`、`GET/PATCH /machines/{id}`、`POST/GET/PATCH /machine-groups`、`GET /machines/{id}/files`、`POST /machines/{id}/request-checkin` |
| Assignments | `POST/GET /machine-assignments`、`POST /machine-assignments/{id}/preview-transform` |
| Deployments | `POST/GET /deployments`、`GET /deployments/{id}` |
| Trials | `GET /trials`、`POST /trials/{id}/promote`、`POST /trials/{id}/pull-back` |
| Mirror / Drift | `GET /drift`、`POST /drift/{id}/accept`、`POST /drift/{id}/reject`、`POST /machine-files/{id}/adopt`、`POST /machines/{id}/adopt-all`、`GET /machine-files/{id}/snapshots`、`POST /machine-files/{id}/restore` |
| Admin | `POST/GET /admin/users`、`POST/GET /admin/service-tokens`、`POST/GET /admin/webhooks`、`GET /admin/webhooks/deliveries` |
| Audit | `GET /audit`、`GET /audit/export`、`GET /audit/verify` |
| Dashboard | `GET /dashboard/summary`、`GET /dashboard/recent-deployments` |
| Operations | `GET /healthz`、`GET /readyz` |

## 6.3.5 集成示例 {#examples}

### 6.3.5.1 CAM 后处理自动上传版本 {#cam-upload}

```bash
TOKEN="dncp_...."
BASE="http://dncpro.shop.local:8030"

# 1. 上传新版本（内容以 base64 传入）
VERSION=$(curl -fsS -X POST "$BASE/api/v1/programs/$PROGRAM_ID/versions" \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-On-Behalf-Of: lichen" \
  -H "Content-Type: application/json" \
  -d "{\"contentBase64\":\"$(base64 -w0 O1001.nc)\",\"notes\":\"CAM 自动出图 · 工单 WO-88213\"}")

VERSION_ID=$(echo "$VERSION" | jq -r .id)

# 2. 提交审批（自动放行的程序库将直接转为已发布）
curl -fsS -X POST "$BASE/api/v1/versions/$VERSION_ID/submit" \
  -H "Authorization: Bearer $TOKEN" -H "X-On-Behalf-Of: lichen"
```

### 6.3.5.2 MES 按工单批量下发 {#mes-deploy}

```bash
curl -fsS -X POST "$BASE/api/v1/deployments" \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-On-Behalf-Of: zhaogang" \
  -H "Content-Type: application/json" \
  -d '{
        "versionId": "01a012b7-....",
        "assignmentIds": ["01a012b8-....", "01a012b8-...."],
        "isTrial": false,
        "trialHours": null
      }'
```

响应返回批次 ID 与每台机台的下发 ID。可逐个轮询 `GET /deployments/{id}` 直至 `status`
变为 `Succeeded` 或 `Failed`，亦可订阅 `deployment.completed` 与 `deployment.failed`
Webhook 以免除轮询，见 [5.9](/guide/admin/#webhooks)。

### 6.3.5.3 看板读取总览数据 {#dashboard}

```bash
curl -fsS "$BASE/api/v1/dashboard/summary" -H "Authorization: Bearer $TOKEN"
```

```json
{
  "gatewaysTotal": 2,
  "gatewaysUnreachable": 0,
  "machinesWithMirrorError": 1,
  "pendingApprovals": 4,
  "openDrift": 4,
  "activeTrials": 2,
  "failedDeployments24h": 1
}
```

### 6.3.5.4 质量追溯：导出指定机台的审计记录 {#audit-export}

```bash
# 查询与导出的筛选参数：principalName、machine、entityType、entityId、category、from、to
curl -fsSG "$BASE/api/v1/audit/export" \
  --data-urlencode "machine=立加01 · 850 立式加工中心" \
  --data-urlencode "from=2026-08-01" \
  --data-urlencode "format=csv" \
  -H "Authorization: Bearer $TOKEN" -o audit.csv

curl -fsS "$BASE/api/v1/audit/verify" -H "Authorization: Bearer $TOKEN"
# {"intact":true,"checked":165,"firstBrokenSeq":null}
```

## 6.3.6 版本策略 {#versioning}

路径中的 `v1` 为契约版本。向后兼容的新增（新增字段、新增端点）在 `v1` 内进行；
破坏性变更启用 `v2`，并在过渡期内与 `v1` 同时提供。
