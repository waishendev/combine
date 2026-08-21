# Multi-Branch Fresh Seed Settings

这份文件集中记录 `php artisan migrate:fresh --seed` 使用的 Multi-Branch settings。它们只控制 local、development、QA 或 staging 的 fresh-install fixtures，不是运行时 Branch Context，也不会引入 Multi-Tenancy。

> **警告：** `migrate:fresh` 会删除当前数据库的所有 tables/data。不要在 production 执行。Fresh Branch/Admin 与 QA fixture seeders 本身也会拒绝 production 环境。

## 完整 `.env` 范例

把以下内容放入 backend 的 `.env`：

```dotenv
# both = Branch One + Branch Two
# branch_one = 只建立 Branch One
MULTI_BRANCH_SEED_PROFILE=both

# true = 建立 MBQA global catalogue 及 Branch-specific QA data
# false = 只建立 Branch 和 Admin，不建立 MBQA QA data
MULTI_BRANCH_SEED_QA_DATA=true

# Branch One
MULTI_BRANCH_SEED_BRANCH_ONE_CODE=PNG
MULTI_BRANCH_SEED_BRANCH_ONE_NAME="Gentlegurls Nail Salon"
MULTI_BRANCH_SEED_BRANCH_ONE_ADMIN_EMAIL=branch1.admin@example.com
MULTI_BRANCH_SEED_BRANCH_ONE_ADMIN_USERNAME=branch1admin

# Branch Two
MULTI_BRANCH_SEED_BRANCH_TWO_CODE=BRANCH2
MULTI_BRANCH_SEED_BRANCH_TWO_NAME="Gentlegurls QA Branch 2"
MULTI_BRANCH_SEED_BRANCH_TWO_ADMIN_EMAIL=branch2.admin@example.com
MULTI_BRANCH_SEED_BRANCH_TWO_ADMIN_USERNAME=branch2admin

# Shared Admin：both profile 时可以管理 Branch One + Branch Two
MULTI_BRANCH_SEED_SHARED_ADMIN_EMAIL=branches.admin@example.com
MULTI_BRANCH_SEED_SHARED_ADMIN_USERNAME=branchesadmin

# 三个 fixture Admin 共用的初始密码；交付前必须更换
MULTI_BRANCH_SEED_ADMIN_PASSWORD=password
```

修改 `.env` 后，如果系统曾经 cache config，先运行：

```bash
php artisan config:clear
```

然后才运行：

```bash
php artisan migrate:fresh --seed
```

## Setting 对照表

| Setting | Default | 允许值 / 格式 | 用途 |
|---|---|---|---|
| `MULTI_BRANCH_SEED_PROFILE` | `both` | `both` 或 `branch_one` | 决定 fresh seed 建立一个还是两个 Branch。其他值会明确失败。 |
| `MULTI_BRANCH_SEED_QA_DATA` | `true` | `true` / `false` | 是否建立 `MBQA` global masters 和 Branch-specific QA fixtures。 |
| `MULTI_BRANCH_SEED_BRANCH_ONE_CODE` | `PNG` | 唯一的 `store_locations.code` | Branch One code；也作为 fresh-install default Branch。 |
| `MULTI_BRANCH_SEED_BRANCH_ONE_NAME` | `Gentlegurls Nail Salon` | Branch display name | Branch One 名称。 |
| `MULTI_BRANCH_SEED_BRANCH_ONE_ADMIN_EMAIL` | `branch1.admin@example.com` | 唯一 email | 只管理 Branch One 的 Admin login email。 |
| `MULTI_BRANCH_SEED_BRANCH_ONE_ADMIN_USERNAME` | `branch1admin` | 唯一 username | Branch One Admin username。 |
| `MULTI_BRANCH_SEED_BRANCH_TWO_CODE` | `BRANCH2` | 唯一的 `store_locations.code` | Branch Two code；`branch_one` profile 不会建立它。 |
| `MULTI_BRANCH_SEED_BRANCH_TWO_NAME` | `Gentlegurls QA Branch 2` | Branch display name | Branch Two 名称。 |
| `MULTI_BRANCH_SEED_BRANCH_TWO_ADMIN_EMAIL` | `branch2.admin@example.com` | 唯一 email | 只管理 Branch Two 的 Admin login email。 |
| `MULTI_BRANCH_SEED_BRANCH_TWO_ADMIN_USERNAME` | `branch2admin` | 唯一 username | Branch Two Admin username。 |
| `MULTI_BRANCH_SEED_SHARED_ADMIN_EMAIL` | `branches.admin@example.com` | 唯一 email | Shared Admin login email。 |
| `MULTI_BRANCH_SEED_SHARED_ADMIN_USERNAME` | `branchesadmin` | 唯一 username | Shared Admin username。 |
| `MULTI_BRANCH_SEED_ADMIN_PASSWORD` | `password` | 初始明文密码 | 三个 fixture Admin 的初始密码；存入数据库时会 hash。请在交付前替换。 |

## Profile 行为

### `both`：测试两个 Branch

```dotenv
MULTI_BRANCH_SEED_PROFILE=both
```

结果：

| Account | Branch One | Branch Two |
|---|---:|---:|
| Branch One Admin | ✅ | ❌ |
| Branch Two Admin | ❌ | ✅ |
| Shared Admin | ✅ | ✅ |

Shared Admin 不是 Platform Super Admin bypass。它和普通 Branch Admin 一样，经由 `store_location_user` 明确取得两个 Branch 的访问权。

### `branch_one`：只测试一个 Branch

```dotenv
MULTI_BRANCH_SEED_PROFILE=branch_one
```

结果：

| Account | Branch One | Branch Two |
|---|---:|---:|
| Branch One Admin | ✅ | 不建立 |
| Branch Two Admin | 不建立 | 不建立 |
| Shared Admin | ✅ | 不建立 |

这个 profile 适合只需要交付单一 Branch 测试环境的情况。

## QA data 开关

### 建立 Branch + Admin + QA data

```dotenv
MULTI_BRANCH_SEED_QA_DATA=true
```

Fresh seed 会建立一份 global `MBQA` Product、Category、Staff、Booking Service identity，然后将 availability、inventory、Staff/Service assignment、Expense Category 和 Expense attribution 写入 profile 选定的 Branch。Global identity 不会按 Branch 复制。

### 只建立 Branch + Admin

```dotenv
MULTI_BRANCH_SEED_QA_DATA=false
```

Branch 和三个 profile-dependent Admin 仍会建立，但会略过 `MBQA` catalogue 和 Multi-Branch QA data pass。

## 自定义为 XXX / CCC

```dotenv
MULTI_BRANCH_SEED_PROFILE=both
MULTI_BRANCH_SEED_QA_DATA=true

MULTI_BRANCH_SEED_BRANCH_ONE_CODE=XXX
MULTI_BRANCH_SEED_BRANCH_ONE_NAME="Branch XXX"
MULTI_BRANCH_SEED_BRANCH_ONE_ADMIN_EMAIL=xxx.admin@example.com
MULTI_BRANCH_SEED_BRANCH_ONE_ADMIN_USERNAME=xxxadmin

MULTI_BRANCH_SEED_BRANCH_TWO_CODE=CCC
MULTI_BRANCH_SEED_BRANCH_TWO_NAME="Branch CCC"
MULTI_BRANCH_SEED_BRANCH_TWO_ADMIN_EMAIL=ccc.admin@example.com
MULTI_BRANCH_SEED_BRANCH_TWO_ADMIN_USERNAME=cccadmin

MULTI_BRANCH_SEED_SHARED_ADMIN_EMAIL=xxx.ccc.admin@example.com
MULTI_BRANCH_SEED_SHARED_ADMIN_USERNAME=xxxcccadmin
MULTI_BRANCH_SEED_ADMIN_PASSWORD=replace-with-a-secure-password
```

运行：

```bash
php artisan config:clear
php artisan migrate:fresh --seed
```

## 与手动 QA Seeder 的区别

以上 settings 只影响 fresh database workflow。对于已经存在、不能清空的 database，请先从 CRM 手动建立 Branch，再使用：

```bash
php artisan multibranch:test-seed --store-code=CCC --dry-run
php artisan multibranch:test-seed --store-code=CCC --force
```

手动 command 不会读取 Branch One/Two code 来决定目标；目标永远来自当次传入的 `--store-code`。

## 安全与重跑

- Branch-specific Admin 只会取得自己的 Branch。
- Shared Admin 只会取得当前 profile 包含的 Branch。
- Admin、Branch 及 QA fixtures 使用稳定 keys，可安全重跑 Seeder。
- Product、Category、Staff 与 Booking Service 是 global identity，只建立一份。
- Expense Category 和 Expense 会写入明确的 `store_location_id`，不会建立新的 legacy `NULL` attribution。
- 不要把 `.env` 的真实密码提交进 Git；`.env.example` 只能保留非敏感示例值。
