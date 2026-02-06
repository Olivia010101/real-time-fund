'use client';

import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { syncService } from '../lib/syncService';

export default function SyncStatus({ onOpenAuth }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState(null);
  const [syncStatus, setSyncStatus] = useState({ syncing: false, lastSyncTime: null, error: null });
  const [signingOut, setSigningOut] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

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

  const handleSignOut = async () => {
    if (!isAuthenticated || signingOut) return;
    setSigningOut(true);
    try {
      // 先同步一次到云端，避免数据丢失
      await syncService.syncToCloud();
      await supabase.auth.signOut();
      setDropdownOpen(false);
    } catch (err) {
      setSyncStatus((prev) => ({
        ...prev,
        error: err.message || '退出失败',
      }));
    } finally {
      setSigningOut(false);
    }
  };

  useEffect(() => {
    if (!dropdownOpen) return;
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [dropdownOpen]);

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
    <div
      style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', position: 'relative' }}
      ref={dropdownRef}
    >
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
        <>
          <button
            className="link-button"
            type="button"
            onClick={() => setDropdownOpen((open) => !open)}
            disabled={signingOut}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--muted)',
              cursor: signingOut ? 'default' : 'pointer',
              textDecoration: 'underline',
              fontSize: '12px',
              marginLeft: '8px',
              padding: 0,
            }}
            title="账号菜单"
          >
            {signingOut ? '退出中…' : (user.email?.split('@')[0] || '用户')}
          </button>
          {dropdownOpen && (
            <div
              className="glass card"
              style={{
                position: 'absolute',
                top: '150%',
                right: 0,
                minWidth: '140px',
                padding: '8px 0',
                zIndex: 20,
                boxShadow: '0 8px 20px rgba(0, 0, 0, 0.25)',
              }}
            >
              <div
                style={{
                  padding: '4px 12px 8px',
                  fontSize: '11px',
                  color: 'var(--muted)',
                  borderBottom: '1px solid var(--border)',
                  marginBottom: 4,
                }}
              >
                {user.email}
              </div>
              <button
                type="button"
                onClick={handleSignOut}
                disabled={signingOut}
                style={{
                  width: '100%',
                  textAlign: 'left',
                  padding: '6px 12px',
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--danger)',
                  fontSize: '12px',
                  cursor: signingOut ? 'default' : 'pointer',
                }}
              >
                {signingOut ? '退出中…' : '退出登录'}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

