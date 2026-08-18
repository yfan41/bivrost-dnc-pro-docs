---
title: "6.2 机床系统差异"
description: 规定 FANUC、西门子、三菱、兄弟等控制系统的文件语义差异及本系统的处理方式
---

## 6.2.1 适用范围 {#scope}

本节规定各厂商控制系统在文件命名、目录与程序号方面的语义差异，以及本系统的处理方式。
适用于配置机台分配与排查下发异常。

本系统内置厂商画像表，按机台的控制系统与型号自动选用。日常使用中无需人工干预，
本节内容用于异常排查。

## 6.2.2 画像对照表 {#matrix}

各控制系统的能力差异按表 6-7 的规定。

<p class="tbl-caption">表 6-7　控制系统能力对照</p>

| 能力 | FANUC 现代<br/>(0i-D/0i-F/30i/31i/32i/35i) | FANUC 传统 | 西门子 | 三菱 | 兄弟 S 系 | 兄弟 TC 系 |
| --- | :---: | :---: | :---: | :---: | :---: | :---: |
| 支持子目录列表 | <span class="sup-y">✓</span> | <span class="sup-n">✗</span> | <span class="sup-y">✓</span> | <span class="sup-n">✗</span> | <span class="sup-y">✓</span> | <span class="sup-y">✓</span> |
| 支持指定目录 | <span class="sup-y">✓</span> | <span class="sup-n">✗</span> | <span class="sup-y">✓</span> | <span class="sup-y">✓</span> | <span class="sup-y">✓</span> | <span class="sup-n">✗</span> |
| 程序名取自内容 | <span class="sup-y">✓</span> | <span class="sup-y">✓</span> | <span class="sup-n">✗</span> | <span class="sup-n">✗</span> | <span class="sup-n">✗</span> | <span class="sup-n">✗</span> |
| 列表去除 O 号前导零 | <span class="sup-y">✓</span> | <span class="sup-n">✗</span> | <span class="sup-n">✗</span> | <span class="sup-n">✗</span> | <span class="sup-n">✗</span> | <span class="sup-n">✗</span> |
| 必须带扩展名 | <span class="sup-n">✗</span> | <span class="sup-n">✗</span> | <span class="sup-y">✓</span> | <span class="sup-n">✗</span> | <span class="sup-n">✗</span> | <span class="sup-n">✗</span> |
| 支持程序号锁定区间 | <span class="sup-y">✓</span> | <span class="sup-y">✓</span> | <span class="sup-n">✗</span> | <span class="sup-y">✓</span> | <span class="sup-n">✗</span> | <span class="sup-n">✗</span> |
| 默认根目录 | `//CNC_MEM/` | 机床当前前台目录 | `/nckfs` | `PRG\USER\` | `/` | `/` |

## 6.2.3 FANUC 程序名规则 {#fanuc-name}

FANUC 控制器在接收文件时忽略传入的文件名参数，程序名取自内容，
即第一个换行符与第二个换行符之间的一行，见图 6-2。

```text
%                         ← 第 1 行
O1001(PUMP BODY ROUGH)    ← 名称行：O1001
G17 G21 G40 G49 G80 G90
```

<p class="shot-caption">图 6-2　FANUC 程序名的 O 号形式</p>

尖括号形式同样有效，见图 6-3。

```text
%
<PUMPROUGH>
G17 G21 ...
```

<p class="shot-caption">图 6-3　FANUC 程序名的尖括号形式</p>

:::danger[警告]
若内容中的程序名为 `O5`，而机台文件名配置为 `O1001` 且未设置名称改写，
该程序将在机床上落地为 `O5`。向 FANUC 机床建立分配时，
应将「程序名改写」设为与机台文件名一致的 O 号。
本系统在发送前改写名称行，同时保留原有的括号注释。
分配配置方法见 [5.3](/guide/assignments/)。
:::

### 6.2.3.1 O 号前导零 {#fanuc-zeros}

标准 O 号在不同接口下的写法不一致：

a) 现代 FANUC 在列目录时去除前导零，`O0010` 显示为 `O10`；

b) 传统 FANUC 在列目录时按存储时的写法显示，但 `readProgramInfo` 接口仍去除前导零。

本系统在匹配与比对时将 `O0010`、`O010`、`o10` 统一归一为 `O10`，
因此配置值为 `O1` 而机床显示为 `O0001` 不会导致失配。

非 O 号形式的名称（如 `SAMPLE`、`<NAME>`）按原样处理，区分大小写。

## 6.2.4 西门子 {#siemens}

:::caution[注意]
西门子的 NC 文件必须带扩展名（`.MPF` 为主程序，`.SPF` 为子程序）。
机台文件名未填写扩展名时，落地将失败。
:::

默认根目录为 `/nckfs`，支持子目录。

## 6.2.5 三菱 {#mitsubishi}

默认根目录为 `PRG\USER\`（使用反斜杠）。支持指定目录，但不支持列出子目录，
本系统仅列出根目录下的文件。

## 6.2.6 兄弟 {#brother}

兄弟系统按型号区分：S 系列（如 S700X1）支持指定目录；TC 系列（如 TC-S2D）不支持，
填写的目录不生效，文件落至根目录。本系统按型号自动选用对应画像。

## 6.2.7 程序号锁定区间 {#lock-ranges}

FANUC 与三菱支持将某一 O 号区间设为受保护区间（例如 O8000～O8999 存放厂商宏）。
向锁定区间内写入将失败。

本系统在下发的预检阶段检查该项，在机床被改动之前终止事务，
此时传输记录中「失败阶段 = 预检」、「回滚 = 无需回滚」，见 [5.4](/guide/transfer/)。

## 6.2.8 归一化比对 {#normalization}

下发第 ⑥ 阶段的校验按上述画像执行归一化，吸收下列无害差异：

a) 行结束符差异；

b) FANUC 的 O 号前导零；

c) 末尾空行的增删。

归一化仅吸收控制器已知的无害变换，真实的内容差异必定被检出。

## 6.2.9 未列出的控制系统 {#others}

彼络物联网关支持的机床系统不限于本节所列。未匹配到具体画像的系统采用保守的通用画像：
不假定支持子目录、不假定支持指定目录、不执行名称改写。此类机床通常可正常工作，
但无法使用上述针对性处理。

:::note[说明]
机床的实际行为与画像不符时，可将传输记录中的失败阶段与失败详情
（见 [5.4](/guide/transfer/#read-log)）反馈给供应方。画像表可以扩充。
:::
