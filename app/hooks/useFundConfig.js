'use client';

import { useRef, useState } from 'react';
import { syncService, DATA_KEYS } from '../lib/syncService';

/**
 * 负责基金配置的导入 / 导出逻辑：
 * - 导出当前 localStorage 中的配置为 JSON 文件
 * - 从文件导入配置并合并到当前状态
 *
 * 通过依赖注入方式复用上层 hooks（useFunds / useFundLayout）中的状态与方法。
 */
export const useFundConfig = ({
  dedupeByCode,
  setFunds,
  setFavorites,
  setGroups,
  setCollapsedCodes,
  updateRefreshMs,
  setViewMode,
  setPositions,
  refreshAll,
  setTempSeconds,
  setSuccessModal,
  setSettingsOpen,
}) => {
  const importFileRef = useRef(null);
  const [importMsg, setImportMsg] = useState('');

  const exportLocalData = async () => {
    try {
      // 从同步服务读取数据（优先从本地，因为导出当前状态）
      const funds = syncService.loadFromLocal(DATA_KEYS.FUNDS, []);
      const favorites = syncService.loadFromLocal(DATA_KEYS.FAVORITES, []);
      const groups = syncService.loadFromLocal(DATA_KEYS.GROUPS, []);
      const collapsedCodes = syncService.loadFromLocal(DATA_KEYS.COLLAPSED_CODES, []);
      const refreshMs = syncService.loadFromLocal(DATA_KEYS.REFRESH_MS, 30000);
      const viewMode = syncService.loadFromLocal(DATA_KEYS.VIEW_MODE, 'card');
      const positions = syncService.loadFromLocal(DATA_KEYS.POSITIONS, {});
      
      const payload = {
        version: 1,
        funds,
        favorites,
        groups,
        collapsedCodes,
        refreshMs,
        viewMode,
        positions,
        exportedAt: new Date().toISOString(),
      };
      const blob = new Blob([JSON.stringify(payload, null, 2)], {
        type: 'application/json',
      });
      if (window.showSaveFilePicker) {
        const handle = await window.showSaveFilePicker({
          suggestedName: `realtime-fund-config-${Date.now()}.json`,
          types: [{ description: 'JSON', accept: { 'application/json': ['.json'] } }],
        });
        const writable = await handle.createWritable();
        await writable.write(blob);
        await writable.close();
        setSuccessModal({ open: true, message: '导出成功' });
        setSettingsOpen(false);
        return;
      }
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `realtime-fund-config-${Date.now()}.json`;
      let done = false;
      const finish = () => {
        if (done) return;
        done = true;
        URL.revokeObjectURL(url);
        setSuccessModal({ open: true, message: '导出成功' });
        setSettingsOpen(false);
      };
      const onVisibility = () => {
        if (document.visibilityState === 'hidden') return;
        finish();
        document.removeEventListener('visibilitychange', onVisibility);
      };
      document.addEventListener('visibilitychange', onVisibility, { once: true });
      a.click();
      setTimeout(finish, 3000);
    } catch (err) {
      console.error('Export error:', err);
    }
  };

  const handleImportFileChange = async (e) => {
    try {
      const file = e.target.files?.[0];
      if (!file) return;
      const text = await file.text();
      const data = JSON.parse(text);
      if (data && typeof data === 'object') {
        // 从同步服务读取最新数据进行合并，防止状态滞后导致的数据丢失
        const currentFunds = syncService.loadFromLocal(DATA_KEYS.FUNDS, []);
        const currentFavorites = syncService.loadFromLocal(DATA_KEYS.FAVORITES, []);
        const currentGroups = syncService.loadFromLocal(DATA_KEYS.GROUPS, []);
        const currentCollapsed = syncService.loadFromLocal(DATA_KEYS.COLLAPSED_CODES, []);

        let mergedFunds = currentFunds;
        let appendedCodes = [];

        if (Array.isArray(data.funds)) {
          const incomingFunds = dedupeByCode(data.funds);
          const existingCodes = new Set(currentFunds.map((f) => f.code));
          const newItems = incomingFunds.filter(
            (f) => f && f.code && !existingCodes.has(f.code)
          );
          appendedCodes = newItems.map((f) => f.code);
          mergedFunds = [...currentFunds, ...newItems];
          setFunds(mergedFunds);
          syncService.save(DATA_KEYS.FUNDS, mergedFunds);
        }

        if (Array.isArray(data.favorites)) {
          const mergedFav = Array.from(
            new Set([...currentFavorites, ...data.favorites])
          );
          setFavorites(new Set(mergedFav));
          syncService.save(DATA_KEYS.FAVORITES, mergedFav);
        }

        if (Array.isArray(data.groups)) {
          // 合并分组：如果 ID 相同则合并 codes，否则添加新分组
          const mergedGroups = [...currentGroups];
          data.groups.forEach((incomingGroup) => {
            const existingIdx = mergedGroups.findIndex(
              (g) => g.id === incomingGroup.id
            );
            if (existingIdx > -1) {
              mergedGroups[existingIdx] = {
                ...mergedGroups[existingIdx],
                codes: Array.from(
                  new Set([
                    ...mergedGroups[existingIdx].codes,
                    ...(incomingGroup.codes || []),
                  ])
                ),
              };
            } else {
              mergedGroups.push(incomingGroup);
            }
          });
          setGroups(mergedGroups);
          syncService.save(DATA_KEYS.GROUPS, mergedGroups);
        }

        if (Array.isArray(data.collapsedCodes)) {
          const mergedCollapsed = Array.from(
            new Set([...currentCollapsed, ...data.collapsedCodes])
          );
          setCollapsedCodes(new Set(mergedCollapsed));
          syncService.save(DATA_KEYS.COLLAPSED_CODES, mergedCollapsed);
        }

        if (typeof data.refreshMs === 'number' && data.refreshMs >= 5000) {
          updateRefreshMs(data.refreshMs);
          setTempSeconds(Math.round(data.refreshMs / 1000));
        }
        if (data.viewMode === 'card' || data.viewMode === 'list') {
          setViewMode(data.viewMode);
        }

        // 兼容导入持仓信息（如果存在）
        if (data.positions && typeof data.positions === 'object') {
          const currentPositions = syncService.loadFromLocal(DATA_KEYS.POSITIONS, {});
          const mergedPositions = {
            ...currentPositions,
            ...data.positions,
          };
          setPositions(mergedPositions);
          syncService.save(DATA_KEYS.POSITIONS, mergedPositions);
        }

        // 导入成功后，仅刷新新追加的基金
        if (appendedCodes.length) {
          const allCodes = mergedFunds.map((f) => f.code);
          await refreshAll(allCodes);
        }

        setSuccessModal({ open: true, message: '导入成功' });
        setSettingsOpen(false); // 导入成功自动关闭设置弹框
        if (importFileRef.current) importFileRef.current.value = '';
      }
    } catch (err) {
      console.error('Import error:', err);
      setImportMsg('导入失败，请检查文件格式');
      setTimeout(() => setImportMsg(''), 4000);
      if (importFileRef.current) importFileRef.current.value = '';
    }
  };

  return {
    importFileRef,
    importMsg,
    exportLocalData,
    handleImportFileChange,
  };
};


