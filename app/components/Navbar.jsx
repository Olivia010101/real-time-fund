'use client';

import { RefreshIcon, SettingsIcon } from './Icons';

export default function Navbar({
  refreshMs,
  refreshing,
  hasFunds,
  onManualRefresh,
  onOpenSettings,
  syncStatus,
  onOpenAuth,
}) {
  return (
    <div className="navbar glass">
      {refreshing && <div className="loading-bar"></div>}
      <div className="brand">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="10" stroke="var(--accent)" strokeWidth="2" />
          <path d="M5 14c2-4 7-6 14-5" stroke="var(--primary)" strokeWidth="2" />
        </svg>
        <span>基估宝</span>
      </div>
      <div className="actions">
        {syncStatus && (
          <div style={{ marginRight: '8px', cursor: 'pointer' }} onClick={onOpenAuth}>
            {syncStatus}
          </div>
        )}
        <div className="badge" title="当前刷新频率">
          <span>刷新</span>
          <strong>{Math.round(refreshMs / 1000)}秒</strong>
        </div>
        <button
          className="icon-button"
          aria-label="立即刷新"
          onClick={onManualRefresh}
          disabled={refreshing || !hasFunds}
          aria-busy={refreshing}
          title="立即刷新"
        >
          <RefreshIcon className={refreshing ? 'spin' : ''} width="18" height="18" />
        </button>
        <button
          className="icon-button"
          aria-label="打开设置"
          onClick={onOpenSettings}
          title="设置"
        >
          <SettingsIcon width="18" height="18" />
        </button>
      </div>
    </div>
  );
}


