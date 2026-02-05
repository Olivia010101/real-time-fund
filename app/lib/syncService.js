'use client';

import { supabase, DATA_KEYS } from './supabase';

/**
 * 数据同步服务
 * 负责在 localStorage 和 Supabase 之间同步数据
 */
class SyncService {
  constructor() {
    this.syncing = false;
    this.lastSyncTime = null;
    this.syncListeners = new Set();
  }

  /**
   * 添加同步状态监听器
   */
  onSyncStatusChange(callback) {
    this.syncListeners.add(callback);
    return () => this.syncListeners.delete(callback);
  }

  /**
   * 通知同步状态变化
   */
  notifySyncStatus(status) {
    this.syncListeners.forEach(cb => cb(status));
  }

  /**
   * 获取当前用户 ID
   */
  async getUserId() {
    const { data: { user } } = await supabase.auth.getUser();
    return user?.id;
  }

  /**
   * 检查是否已登录
   */
  async isAuthenticated() {
    const { data: { session } } = await supabase.auth.getSession();
    return !!session;
  }

  /**
   * 从 Supabase 读取用户数据
   */
  async loadFromCloud(key) {
    try {
      const userId = await this.getUserId();
      if (!userId) return null;

      const { data, error } = await supabase
        .from('user_data')
        .select('value')
        .eq('user_id', userId)
        .eq('key', key)
        .single();

      if (error) {
        // 说明：
        // - 使用 .single() 且没有数据时，PostgREST 会返回：
        //   - code: 'PGRST116' （未找到）
        //   - 或 HTTP 406（Not Acceptable，表示无单行结果可返回）
        //   这些情况都属于「没有数据」，不应该当成真正的错误。
        if (error.code === 'PGRST116' || error.status === 406) {
          return null;
        }
        throw error;
      }

      return data?.value ? JSON.parse(data.value) : null;
    } catch (error) {
      console.error(`从云端加载 ${key} 失败:`, error);
      return null;
    }
  }

  /**
   * 保存数据到 Supabase
   */
  async saveToCloud(key, value) {
    try {
      const userId = await this.getUserId();
      if (!userId) {
        console.warn('用户未登录，无法保存到云端');
        return false;
      }

      const valueStr = JSON.stringify(value);
      const { error } = await supabase
        .from('user_data')
        .upsert({
          user_id: userId,
          key,
          value: valueStr,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'user_id,key',
        });

      if (error) throw error;
      return true;
    } catch (error) {
      console.error(`保存 ${key} 到云端失败:`, error);
      return false;
    }
  }

  /**
   * 从 localStorage 读取数据
   */
  loadFromLocal(key, defaultValue = null) {
    const item = localStorage.getItem(key);
    if (item === null || item === undefined) return defaultValue;

    try {
      // 优先按 JSON 解析（新格式）
      return JSON.parse(item);
    } catch {
      // 兼容历史数据：旧版本直接存了原始字符串 / 数字
      // - 布尔
      if (item === 'true') return true;
      if (item === 'false') return false;
      // - 数字
      const num = Number(item);
      if (!Number.isNaN(num) && item.trim() !== '') return num;
      // - 其他情况按纯字符串返回
      return item;
    }
  }

  /**
   * 保存数据到 localStorage
   */
  saveToLocal(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (error) {
      console.error(`保存 ${key} 到本地失败:`, error);
      return false;
    }
  }

  /**
   * 同步所有数据到云端
   */
  async syncToCloud() {
    if (this.syncing) return;
    
    const isAuth = await this.isAuthenticated();
    if (!isAuth) {
      console.log('用户未登录，跳过云端同步');
      return;
    }

    this.syncing = true;
    this.notifySyncStatus({ syncing: true, lastSyncTime: null });

    try {
      const keys = Object.values(DATA_KEYS);
      let successCount = 0;

      for (const key of keys) {
        const localValue = this.loadFromLocal(key);
        if (localValue !== null) {
          const success = await this.saveToCloud(key, localValue);
          if (success) successCount++;
        }
      }

      this.lastSyncTime = new Date();
      this.notifySyncStatus({ 
        syncing: false, 
        lastSyncTime: this.lastSyncTime,
        success: successCount === keys.length 
      });

      return successCount === keys.length;
    } catch (error) {
      console.error('同步到云端失败:', error);
      this.notifySyncStatus({ 
        syncing: false, 
        lastSyncTime: this.lastSyncTime,
        error: error.message 
      });
      return false;
    } finally {
      this.syncing = false;
    }
  }

  /**
   * 从云端同步所有数据到本地
   */
  async syncFromCloud() {
    if (this.syncing) return;
    
    const isAuth = await this.isAuthenticated();
    if (!isAuth) {
      console.log('用户未登录，跳过云端同步');
      return;
    }

    this.syncing = true;
    this.notifySyncStatus({ syncing: true, lastSyncTime: null });

    try {
      const keys = Object.values(DATA_KEYS);
      let successCount = 0;

      for (const key of keys) {
        const cloudValue = await this.loadFromCloud(key);
        if (cloudValue !== null) {
          this.saveToLocal(key, cloudValue);
          successCount++;
        }
      }

      this.lastSyncTime = new Date();
      this.notifySyncStatus({ 
        syncing: false, 
        lastSyncTime: this.lastSyncTime,
        success: successCount > 0 
      });

      return successCount > 0;
    } catch (error) {
      console.error('从云端同步失败:', error);
      this.notifySyncStatus({ 
        syncing: false, 
        lastSyncTime: this.lastSyncTime,
        error: error.message 
      });
      return false;
    } finally {
      this.syncing = false;
    }
  }

  /**
   * 智能合并：优先使用最新的数据
   */
  async smartMerge() {
    const isAuth = await this.isAuthenticated();
    if (!isAuth) return;

    try {
      const keys = Object.values(DATA_KEYS);
      
      for (const key of keys) {
        const localValue = this.loadFromLocal(key);
        const cloudValue = await this.loadFromCloud(key);

        if (cloudValue === null && localValue !== null) {
          // 本地有数据，云端没有，上传到云端
          await this.saveToCloud(key, localValue);
        } else if (cloudValue !== null && localValue === null) {
          // 云端有数据，本地没有，下载到本地
          this.saveToLocal(key, cloudValue);
        } else if (cloudValue !== null && localValue !== null) {
          // 两边都有数据，需要合并策略
          // 对于数组类型，合并去重
          // 对于对象类型，合并属性
          const merged = this.mergeData(cloudValue, localValue);
          this.saveToLocal(key, merged);
          await this.saveToCloud(key, merged);
        }
      }
    } catch (error) {
      console.error('智能合并失败:', error);
    }
  }

  /**
   * 合并两个数据对象
   */
  mergeData(cloudData, localData) {
    // 如果是数组，合并去重
    if (Array.isArray(cloudData) && Array.isArray(localData)) {
      // 对于基金列表，按 code 去重
      if (localData.length > 0 && localData[0]?.code) {
        const codeMap = new Map();
        [...cloudData, ...localData].forEach(item => {
          if (item?.code) {
            codeMap.set(item.code, item);
          }
        });
        return Array.from(codeMap.values());
      }
      // 普通数组，合并去重
      return Array.from(new Set([...cloudData, ...localData]));
    }

    // 如果是对象，合并属性
    if (typeof cloudData === 'object' && typeof localData === 'object' && 
        cloudData !== null && localData !== null) {
      return { ...cloudData, ...localData };
    }

    // 其他情况，优先使用本地数据
    return localData;
  }

  /**
   * 保存数据（同时保存到本地和云端）
   */
  async save(key, value) {
    // 先保存到本地（快速响应）
    this.saveToLocal(key, value);
    
    // 异步保存到云端
    const isAuth = await this.isAuthenticated();
    if (isAuth) {
      this.saveToCloud(key, value).catch(err => {
        console.error(`保存 ${key} 到云端失败:`, err);
      });
    }
  }

  /**
   * 读取数据（优先从本地读取，然后尝试从云端同步）
   */
  async load(key, defaultValue = null) {
    // 先从本地读取
    const localValue = this.loadFromLocal(key, defaultValue);
    
    // 如果已登录，尝试从云端同步
    const isAuth = await this.isAuthenticated();
    if (isAuth) {
      const cloudValue = await this.loadFromCloud(key);
      if (cloudValue !== null) {
        // 合并数据
        const merged = this.mergeData(cloudValue, localValue);
        this.saveToLocal(key, merged);
        return merged;
      }
    }

    return localValue;
  }
}

// 导出单例和数据键常量
export const syncService = new SyncService();
export { DATA_KEYS } from './supabase';
