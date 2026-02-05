'use client';

import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { syncService } from '../lib/syncService';

export default function SyncStatus({ onOpenAuth }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState(null);
  const [syncStatus, setSyncStatus] = useState({ syncing: false, lastSyncTime: null, error: null });

  useEffect(() => {
    // 检查认证状态
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setIsAuthenticated(!!session);
      setUser(session?.user || null);
    };

    checkAuth();

    // 监听认证状态变化
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setIsAuthenticated(!!session);
      setUser(session?.user || null);
      
      if (event === 'SIGNED_IN' && session) {
        // 登录后自动同步
        syncService.smartMerge();
      }
    });

    // 监听同步状态
    const unsubscribe = syncService.onSyncStatusChange(setSyncStatus);

    // 定期同步（每 5 分钟）
    const syncInterval = setInterval(() => {
      if (isAuthenticated) {
        syncService.syncToCloud();
      }
    }, 5 * 60 * 1000);

    return () => {
      subscription.unsubscribe();
      unsubscribe();
      clearInterval(syncInterval);
    };
  }, [isAuthenticated]);

  const handleManualSync = async () => {
    if (!isAuthenticated) {
      onOpenAuth?.();
      return;
    }
    await syncService.syncToCloud();
  };

  const formatTime = (date) => {
    if (!date) return '';
    const now = new Date();
    const diff = now - date;
    const minutes = Math.floor(diff / 60000);
    
    if (minutes < 1) return '刚刚';
    if (minutes < 60) return `${minutes} 分钟前`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} 小时前`;
    return date.toLocaleDateString('zh-CN');
  };

  if (!isAuthenticated) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: 'var(--muted)' }}>
        <span>未登录</span>
        <button
          className="link-button"
          onClick={() => onOpenAuth?.()}
          style={{ 
            background: 'none', 
            border: 'none', 
            color: 'var(--primary)', 
            cursor: 'pointer', 
            textDecoration: 'underline',
            fontSize: '12px',
            padding: 0
          }}
        >
          登录以同步
        </button>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px' }}>
      {syncStatus.syncing ? (
        <>
          <div className="spinner" style={{ width: '12px', height: '12px' }} />
          <span style={{ color: 'var(--muted)' }}>同步中...</span>
        </>
      ) : syncStatus.error ? (
        <>
          <span style={{ color: 'var(--danger)' }}>同步失败</span>
          <button
            className="link-button"
            onClick={handleManualSync}
            style={{ 
              background: 'none', 
              border: 'none', 
              color: 'var(--primary)', 
              cursor: 'pointer', 
              textDecoration: 'underline',
              fontSize: '12px',
              padding: 0
            }}
          >
            重试
          </button>
        </>
      ) : (
        <>
          <span style={{ color: 'var(--success)' }}>●</span>
          <span style={{ color: 'var(--muted)' }}>
            {syncStatus.lastSyncTime 
              ? `已同步 ${formatTime(syncStatus.lastSyncTime)}`
              : '已登录'}
          </span>
          <button
            className="link-button"
            onClick={handleManualSync}
            style={{ 
              background: 'none', 
              border: 'none', 
              color: 'var(--primary)', 
              cursor: 'pointer', 
              textDecoration: 'underline',
              fontSize: '12px',
              padding: 0,
              marginLeft: '4px'
            }}
            title="手动同步"
          >
            同步
          </button>
        </>
      )}
      {user && (
        <span style={{ color: 'var(--muted)', marginLeft: '8px' }}>
          {user.email?.split('@')[0] || '用户'}
        </span>
      )}
    </div>
  );
}

