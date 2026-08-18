---
title: "6.3. REST API"
description: 认证方式、错误约定、端点总览与集成示例
---

DNC Pro 是**接口优先**的：管理控制台和机边操作台都是这套 API 的客户端，
**没有任何私有接口**。界面上能做的事，接口都能做。

- 交互式参考：`http://<主机>:8030/api/docs`
- OpenAPI 3.1 文档：`http://<主机>:8030/openapi/v1.json`

![API 参考](/img/console/api-docs.png)

:::note
每个接口都带摘要、分组标签和它的错误响应说明——
这不是靠自觉维护的：构建时有测试检查，只要有接口漏写文档就构建失败。
:::

## 认证 {#auth}

### 交互式客户端（浏览器） {#cookie}

```http
POST /api/v1/auth/login
Content-Type: application/json

{ "username": "lichen", "password": "..." }
```

成功后种下会话 Cookie。**所有非 GET 请求还必须带**：

```http
X-Requested-With: XMLHttpRequest
```

这是 CSRF 防护——纯 XHR 的单页应用天然会带这个头，跨站表单提交带不了。

### 机器对机器 {#token}

用[服务令牌](/guide/admin/#tokens)：

```http
Authorization: Bearer dncp_<id>_<secret>
```

可以再带上操作人，让审计能落到具体的人：

```http
X-On-Behalf-Of: lichen
```

令牌若开启了"高危需操作人"，则下发、删除这类动作**必须**带这个头。

## 错误约定 {#errors}

失败一律返回 RFC 7807 problem document：

| 状态码 | 含义 |
| --- | --- |
| **400** | 请求本身不合法 |
| **401** | 未认证 / 会话过期 / 令牌无效 |
| **403** | 角色或授权范围覆盖不到目标 |
| **404** | 对象不存在，或你的范围里看不到它 |
| **409** | 与当前生命周期状态冲突（例如下发一个草稿版本） |
| **422** | 请求能被理解，但内容不可接受 |
| **503** | 依赖不可用（见 `/readyz`） |

**403 查授权，409 查状态**——这两个是集成时最常遇到的。

## 端点总览 {#endpoints}

| 分组 | 主要端点 |
| --- | --- |
| **Auth** | `POST /api/v1/auth/login` `POST /auth/logout` `POST /auth/change-password` `GET /auth/me` |
| **Vault** | `POST/GET /libraries` · `POST/GET /programs` · `POST/GET /programs/{id}/versions` · `POST /versions/{id}/submit` · `GET /programs/{id}/diff` · `GET /versions/{id}/content` · `POST /versions/{id}/obsolete` |
| **Approvals** | `GET /approvals` · `POST /approvals/{id}/decide` |
| **Fleet** | `POST/GET /gateways` · `POST /gateways/{id}/sync` · `GET/PATCH /machines/{id}` · `POST/GET/PATCH /machine-groups` · `GET /machines/{id}/files` · `POST /machines/{id}/request-checkin` |
| **Assignments** | `POST/GET /machine-assignments` · `POST /machine-assignments/{id}/preview-transform` |
| **Deployments** | `POST/GET /deployments` · `GET /deployments/{id}` |
| **Trials** | `GET /trials` · `POST /trials/{id}/promote` · `POST /trials/{id}/pull-back` |
| **Mirror / Drift** | `GET /drift` · `POST /drift/{id}/accept` · `POST /drift/{id}/reject` · `POST /machine-files/{id}/adopt` · `POST /machines/{id}/adopt-all` · `GET /machine-files/{id}/snapshots` · `POST /machine-files/{id}/restore` |
| **Admin** | `POST/GET /admin/users` · `POST/GET /admin/service-tokens` · `POST/GET /admin/webhooks` · `GET /admin/webhooks/deliveries` |
| **Audit** | `GET /audit` · `GET /audit/export` · `GET /audit/verify` |
| **Dashboard** | `GET /dashboard/summary` · `GET /dashboard/recent-deployments` |
| **Operations** | `GET /healthz` · `GET /readyz` |

## 集成示例 {#examples}

### CAM 后处理自动上传新版本 {#cam-upload}

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

# 2. 提交审批（自动放行的程序库会直接变成已发布）
curl -fsS -X POST "$BASE/api/v1/versions/$VERSION_ID/submit" \
  -H "Authorization: Bearer $TOKEN" -H "X-On-Behalf-Of: lichen"
```

### MES 按工单批量下发 {#mes-deploy}

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

返回批次 ID 和每台机床的下发 ID，逐个轮询 `GET /deployments/{id}` 直到
`status` 变为 `Succeeded` 或 `Failed`。也可以订阅
[`deployment.completed` / `deployment.failed` Webhook](/guide/admin/#webhooks)
免去轮询。

### 看板拉总览数字 {#dashboard}

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

### 质量追溯：导出某台机床的审计 {#audit-export}

```bash
# 查询/导出的筛选参数：principalName、machine、entityType、entityId、category、from、to
curl -fsSG "$BASE/api/v1/audit/export" \
  --data-urlencode "machine=立加01 · 850 立式加工中心" \
  --data-urlencode "from=2026-08-01" \
  --data-urlencode "format=csv" \
  -H "Authorization: Bearer $TOKEN" -o audit.csv

curl -fsS "$BASE/api/v1/audit/verify" -H "Authorization: Bearer $TOKEN"
# {"intact":true,"checked":165,"firstBrokenSeq":null}
```

## 版本策略 {#versioning}

路径里的 `v1` 是**契约版本**。向后兼容的新增（新字段、新端点）在 `v1` 内进行；
破坏性变更会启用 `v2` 并在过渡期内同时提供。
