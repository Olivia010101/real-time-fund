# Supabase 多设备同步设置指南

本文档说明如何配置 Supabase 以实现基金数据的多设备同步功能。

## 步骤 1: 创建 Supabase 项目

1. 访问 [Supabase](https://supabase.com/)
2. 注册/登录账号
3. 点击 "New Project" 创建新项目
4. 填写项目信息：
   - **Name**: 项目名称（如：real-time-fund）
   - **Database Password**: 设置数据库密码（请妥善保存）
   - **Region**: 选择离你最近的区域（如：Southeast Asia (Singapore)）
5. 等待项目创建完成（约 2 分钟）

## 步骤 2: 获取 API 密钥

1. 在项目 Dashboard 中，点击左侧菜单的 **Settings** → **API**
2. 找到以下信息：
   - **Project URL**: 复制此 URL
   - **anon public key**: 复制此密钥（这是公开的客户端密钥，可以安全地在前端使用）

## 步骤 3: 配置环境变量

1. 在项目根目录创建 `.env.local` 文件（如果不存在）
2. 添加以下内容：

```env
NEXT_PUBLIC_SUPABASE_URL=你的_Project_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=你的_anon_public_key
```

**注意**: `.env.local` 文件已添加到 `.gitignore`，不会被提交到 Git。

## 步骤 4: 创建数据库表

1. 在 Supabase Dashboard 中，点击左侧菜单的 **SQL Editor**
2. 点击 **New query**
3. 复制 `supabase-migration.sql` 文件中的 SQL 脚本
4. 粘贴到 SQL Editor 中
5. 点击 **Run** 执行脚本

这将创建：
- `user_data` 表：存储用户的基金数据
- 行级安全策略（RLS）：确保用户只能访问自己的数据
- 索引：提高查询性能

## 步骤 5: 配置认证（可选）

默认情况下，Supabase 已启用邮箱/密码认证。如果需要其他认证方式：

1. 在 Dashboard 中，点击 **Authentication** → **Providers**
2. 启用你需要的认证方式（如：Google、GitHub 等）

## 步骤 6: 安装依赖并运行

```bash
# 安装 Supabase 客户端
npm install @supabase/supabase-js

# 运行开发服务器
npm run dev
```

## 使用说明

### 首次使用

1. 打开应用，点击导航栏右侧的同步状态区域
2. 点击 "登录以同步"
3. 注册新账号（邮箱 + 密码）
4. 登录后，数据会自动同步到云端

### 多设备同步

1. 在设备 A 上登录并添加基金
2. 在设备 B 上登录同一账号
3. 数据会自动从云端同步到设备 B

### 数据同步机制

- **自动同步**：登录后自动合并本地和云端数据
- **实时保存**：每次修改数据时，同时保存到本地和云端
- **定期同步**：每 5 分钟自动同步一次
- **手动同步**：点击同步状态区域可手动触发同步

## 数据存储说明

以下数据会被同步到云端：
- 基金列表（funds）
- 持仓信息（positions）
- 自选基金（favorites）
- 分组信息（groups）
- 折叠状态（collapsedCodes）
- 刷新频率（refreshMs）
- 视图模式（viewMode）

## 成本说明

Supabase 免费层包含：
- 500MB 数据库存储
- 2GB 文件存储
- 50,000 月活跃用户
- 2GB 带宽/月

对于个人使用，免费层通常足够。如果超出限制，可以考虑：
- 升级到 Pro 计划（$25/月）
- 优化数据存储（定期清理旧数据）
- 自托管 Supabase

## 故障排除

### 同步失败

1. 检查网络连接
2. 检查 Supabase 项目是否正常运行
3. 检查环境变量是否正确配置
4. 查看浏览器控制台的错误信息

### 数据冲突

系统会自动合并数据：
- 数组类型：合并去重
- 对象类型：合并属性
- 基金列表：按 code 去重

### 无法登录

1. 检查邮箱是否已验证（如果启用了邮箱验证）
2. 检查密码是否正确
3. 尝试重置密码

## 安全说明

- 所有数据都通过 HTTPS 加密传输
- 使用行级安全（RLS）确保用户只能访问自己的数据
- API 密钥是公开的，但通过 RLS 保护数据安全
- 密码使用 Supabase 的加密存储

## 更多资源

- [Supabase 文档](https://supabase.com/docs)
- [Supabase 定价](https://supabase.com/pricing)
- [Supabase 社区](https://github.com/supabase/supabase)

