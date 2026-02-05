'use client';

import { createClient } from '@supabase/supabase-js';

// Supabase 配置
// 这些值需要从 Supabase 项目设置中获取
// 为了安全，建议使用环境变量
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Supabase 配置缺失，请设置 NEXT_PUBLIC_SUPABASE_URL 和 NEXT_PUBLIC_SUPABASE_ANON_KEY 环境变量');
}

// 创建 Supabase 客户端
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

// 数据库表结构定义（用于类型提示）
export const TABLES = {
  USER_DATA: 'user_data',
};

// 用户数据结构
export const DATA_KEYS = {
  FUNDS: 'funds',
  POSITIONS: 'positions',
  FAVORITES: 'favorites',
  GROUPS: 'groups',
  COLLAPSED_CODES: 'collapsedCodes',
  REFRESH_MS: 'refreshMs',
  VIEW_MODE: 'viewMode',
};

