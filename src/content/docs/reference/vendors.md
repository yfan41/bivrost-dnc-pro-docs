---
title: "6.2. 机床系统差异"
description: FANUC / 西门子 / 三菱 / 兄弟的文件系统语义差异，以及 DNC Pro 怎么处理
---

不同厂商的控制器在"文件"这件事上的语义差别很大。
DNC Pro 内置一份**厂商画像**表，按机床的系统与型号自动选用，
你在日常使用中通常不需要关心——但排查问题时知道这些会快很多。

## 画像对照表 {#matrix}

| 能力 | FANUC 现代<br/>(0i-D/0i-F/30i/31i/32i/35i) | FANUC 传统 | 西门子 | 三菱 | 兄弟 S 系 | 兄弟 TC 系 |
| --- | :---: | :---: | :---: | :---: | :---: | :---: |
| 支持子目录列表 | <span class="sup-y">✓</span> | <span class="sup-n">✗</span> | <span class="sup-y">✓</span> | <span class="sup-n">✗</span> | <span class="sup-y">✓</span> | <span class="sup-y">✓</span> |
| 支持指定目录 | <span class="sup-y">✓</span> | <span class="sup-n">✗</span> | <span class="sup-y">✓</span> | <span class="sup-y">✓</span> | <span class="sup-y">✓</span> | <span class="sup-n">✗</span> |
| **程序名取自内容** | <span class="sup-y">✓</span> | <span class="sup-y">✓</span> | <span class="sup-n">✗</span> | <span class="sup-n">✗</span> | <span class="sup-n">✗</span> | <span class="sup-n">✗</span> |
| 列表去掉 O 号前导零 | <span class="sup-y">✓</span> | <span class="sup-n">✗</span> | <span class="sup-n">✗</span> | <span class="sup-n">✗</span> | <span class="sup-n">✗</span> | <span class="sup-n">✗</span> |
| **必须带扩展名** | <span class="sup-n">✗</span> | <span class="sup-n">✗</span> | <span class="sup-y">✓</span> | <span class="sup-n">✗</span> | <span class="sup-n">✗</span> | <span class="sup-n">✗</span> |
| 支持程序号锁定区间 | <span class="sup-y">✓</span> | <span class="sup-y">✓</span> | <span class="sup-n">✗</span> | <span class="sup-y">✓</span> | <span class="sup-n">✗</span> | <span class="sup-n">✗</span> |
| 默认根目录 | `//CNC_MEM/` | 机床当前前台目录 | `/nckfs` | `PRG\USER\` | `/` | `/` |

## FANUC：程序名来自内容 {#fanuc-name}

**这是最重要的一条差异。**

FANUC 控制器在接收文件时**忽略你传的文件名**，程序名取自内容——
具体是**第一个换行符与第二个换行符之间的那一行**：

```text
%                         ← 第 1 行
O1001(PUMP BODY ROUGH)    ← 名字行：O1001
G17 G21 G40 G49 G80 G90
```

也支持尖括号形式：

```text
%
<PUMPROUGH>
G17 G21 ...
```

### 后果与对策 {#fanuc-consequence}

如果内容里写着 `O5`，你把它分配到机台文件名 `O1001` 却没做名称改写，
它在机床上会落成 **O5**。

**对策**：给 FANUC 机床建[分配](/guide/assignments/)时，
把"程序名改写"设为与机台文件名相同的 O 号。DNC Pro 会在发送前把名字行改掉，
同时保留原有的括号注释。

### 前导零 {#fanuc-zeros}

标准 O 号在不同接口下的写法不一致：

- **现代 FANUC** 列目录时去掉前导零：`O0010` → `O10`
- **传统 FANUC** 列目录时显示存储时的写法，但 `readProgramInfo` 仍然去零

DNC Pro 在匹配和比对时会把 `O0010`、`O010`、`o10` 统统归一到 `O10`，
所以你填 `O1` 而机床显示 `O0001` 不会造成失配。

非 O 号的名字（`SAMPLE`、`<NAME>`）按原样处理，**区分大小写**。

## 西门子：必须带扩展名 {#siemens}

西门子的 NC 文件必须带扩展名（`.MPF` 主程序、`.SPF` 子程序）。
给西门子机床的[分配](/guide/assignments/)填机台文件名时一定要带上，
否则落地会失败。

默认根目录是 `/nckfs`，支持子目录。

## 三菱 {#mitsubishi}

默认根目录 `PRG\USER\`（注意是反斜杠）。支持指定目录，但**不支持列子目录**——
DNC Pro 只会列出根目录下的文件。

## 兄弟：S 系与 TC 系不一样 {#brother}

同为兄弟，S 系列（如 S700X1）支持指定目录，
TC 系列（如 TC-S2D）**不支持**——填了目录也会落到根目录。
DNC Pro 按型号自动区分。

## 程序号锁定区间 {#lock-ranges}

FANUC 和三菱支持把某个 O 号区间设为受保护（例如 O8000–O8999 存放厂商宏）。
向锁定区间内的号写入会失败。

DNC Pro 在[下发](/guide/transfer/)的**预检**阶段就检查这一点，
在动机床之前失败，`失败阶段 = 预检`、`回滚 = 无需回滚`。

## 归一化比对 {#normalization}

下发第 ⑥ 步的校验按上述画像做归一化，吸收：

- 行结束符差异
- FANUC O 号前导零
- 末尾空行的增删

**真正的内容差异一定会被抓到**——归一化只吸收控制器已知的无害变换。

## 未列出的系统 {#others}

彼络网关支持的机床系统[远不止这几家](https://docs.bivrost.cn/gateway/)。
未匹配到具体画像的系统会使用一份保守的通用画像：
不假设支持子目录、不假设支持指定目录、不做名称改写。
这类机床通常也能正常工作，只是无法利用上述优化。

如果你的机床在实际使用中表现出与画像不符的行为，
把[传输记录](/guide/transfer/#read-log)里的失败阶段和详情发给我们——
画像表是可以扩充的。
