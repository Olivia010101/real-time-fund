'use client';

import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { syncService } from '../lib/syncService';
import { motion, AnimatePresence } from 'framer-motion';
import { CloseIcon } from './Icons';

export default function AuthModal({ onClose, onAuthSuccess }) {
  const [mode, setMode] = useState('login'); // 'login' | 'signup'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    // 检查是否已有会话
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        onAuthSuccess?.();
        onClose();
      }
    });
  }, [onAuthSuccess, onClose]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');
    setLoading(true);

    try {
      if (mode === 'signup') {
        const { data, error: signUpError } = await supabase.auth.signUp({
          email,
          password,
        });

        if (signUpError) throw signUpError;

        if (data.user) {
          setMessage('注册成功！请检查邮箱验证链接（如果启用了邮箱验证）');
          // 注册成功后自动登录
          setTimeout(() => {
            setMode('login');
            setMessage('');
          }, 2000);
        }
      } else {
        const { data, error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (signInError) throw signInError;

        if (data.user) {
          // 登录成功后同步数据
          await syncService.smartMerge();
          onAuthSuccess?.();
          onClose();
        }
      }
    } catch (err) {
      setError(err.message || '操作失败，请重试');
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    setLoading(true);
    try {
      // 先同步数据到云端
      await syncService.syncToCloud();
      await supabase.auth.signOut();
      onClose();
    } catch (err) {
      setError(err.message || '退出失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="glass card modal auth-modal"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="title auth-modal-header">
          <div className="auth-modal-title-main">
            <span>{mode === 'login' ? '登录' : '注册'}</span>
            <span className="muted auth-modal-subtitle">
              登录后可在多设备间同步你的基金配置
            </span>
          </div>
          <button className="icon-button" onClick={onClose} aria-label="关闭登录弹窗">
            <CloseIcon width="20" height="20" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="auth-field">
            <label className="auth-label">邮箱</label>
            <input
              type="email"
              className="input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your@email.com"
              required
              disabled={loading}
            />
          </div>

          <div className="auth-field">
            <label className="auth-label">密码</label>
            <input
              type="password"
              className="input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="至少 6 位字符"
              required
              minLength={6}
              disabled={loading}
            />
          </div>

          {error && (
            <div className="error-message" style={{ color: 'var(--danger)', fontSize: '14px' }}>
              {error}
            </div>
          )}

          {message && (
            <div className="success-message" style={{ color: 'var(--success)', fontSize: '14px' }}>
              {message}
            </div>
          )}

          <button
            type="submit"
            className="button"
            disabled={loading}
            style={{ width: '100%' }}
          >
            {loading ? '处理中...' : mode === 'login' ? '登录' : '注册'}
          </button>

          <div style={{ textAlign: 'center', fontSize: '14px' }}>
            {mode === 'login' ? (
              <>
                还没有账号？{' '}
                <button
                  type="button"
                  className="link-button"
                  onClick={() => {
                    setMode('signup');
                    setError('');
                    setMessage('');
                  }}
                  style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', textDecoration: 'underline' }}
                >
                  立即注册
                </button>
              </>
            ) : (
              <>
                已有账号？{' '}
                <button
                  type="button"
                  className="link-button"
                  onClick={() => {
                    setMode('login');
                    setError('');
                    setMessage('');
                  }}
                  style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', textDecoration: 'underline' }}
                >
                  立即登录
                </button>
              </>
            )}
          </div>
        </form>

        <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid var(--border)', fontSize: '12px', color: 'var(--muted)', textAlign: 'center' }}>
          <p>登录后，您的数据将自动同步到云端，可在多设备间访问</p>
        </div>
      </motion.div>
    </div>
  );
}

