'use client';

import { useEffect, useState } from 'react';
import { syncService, DATA_KEYS } from '../lib/syncService';

/**
 * 管理与布局相关的状态：
 * - 分组
 * - 自选
 * - 前 10 重仓折叠状态
 * - 当前 tab
 * - 视图模式（card / list）
 *
 * 同时负责这些状态的本地存储读写。
 */
export const useFundLayout = (funds) => {
  const [collapsedCodes, setCollapsedCodes] = useState(new Set());
  const [favorites, setFavorites] = useState(new Set());
  const [groups, setGroups] = useState([]); // [{ id, name, codes: [] }]
  const [currentTab, setCurrentTab] = useState('all');
  const [viewMode, setViewMode] = useState('card'); // card, list

  // 初始化：从本地/云端读取布局相关状态
  useEffect(() => {
    const loadData = async () => {
      try {
        const savedCollapsed = await syncService.load(DATA_KEYS.COLLAPSED_CODES, []);
        if (Array.isArray(savedCollapsed)) {
          setCollapsedCodes(new Set(savedCollapsed));
        }
        const savedFavorites = await syncService.load(DATA_KEYS.FAVORITES, []);
        if (Array.isArray(savedFavorites)) {
          setFavorites(new Set(savedFavorites));
        }
        const savedGroups = await syncService.load(DATA_KEYS.GROUPS, []);
        if (Array.isArray(savedGroups)) {
          setGroups(savedGroups);
        }
        const savedViewMode = await syncService.load(DATA_KEYS.VIEW_MODE, 'card');
        if (savedViewMode === 'card' || savedViewMode === 'list') {
          setViewMode(savedViewMode);
        }
      } catch {
        // ignore
      }
    };
    
    loadData();
  }, []);

  // 默认收起前 10 重仓股票：初始时将所有已存在基金 code 加入 collapsedCodes
  useEffect(() => {
    if (!funds || !funds.length) return;
    setCollapsedCodes((prev) => {
      const next = new Set(prev);
      let changed = false;
      funds.forEach((f) => {
        if (f && f.code && !next.has(f.code)) {
          next.add(f.code);
          changed = true;
        }
      });
      if (changed) {
        syncService.save(DATA_KEYS.COLLAPSED_CODES, Array.from(next));
      }
      return changed ? next : prev;
    });
  }, [funds]);

  const toggleFavorite = (code) => {
    setFavorites((prev) => {
      const next = new Set(prev);
      if (next.has(code)) {
        next.delete(code);
      } else {
        next.add(code);
      }
      syncService.save(DATA_KEYS.FAVORITES, Array.from(next));
      if (next.size === 0) setCurrentTab('all');
      return next;
    });
  };

  const toggleCollapse = (code) => {
    setCollapsedCodes((prev) => {
      const next = new Set(prev);
      if (next.has(code)) {
        next.delete(code);
      } else {
        next.add(code);
      }
      syncService.save(DATA_KEYS.COLLAPSED_CODES, Array.from(next));
      return next;
    });
  };

  const addGroup = (name) => {
    const newGroup = {
      id: `group_${Date.now()}`,
      name,
      codes: [],
    };
    const next = [...groups, newGroup];
    setGroups(next);
    syncService.save(DATA_KEYS.GROUPS, next);
    setCurrentTab(newGroup.id);
  };

  const removeGroup = (id) => {
    const next = groups.filter((g) => g.id !== id);
    setGroups(next);
    syncService.save(DATA_KEYS.GROUPS, next);
    if (currentTab === id) setCurrentTab('all');
  };

  const updateGroups = (newGroups) => {
    setGroups(newGroups);
    syncService.save(DATA_KEYS.GROUPS, newGroups);
    // 如果当前选中的分组被删除了，切换回“全部”
    if (
      currentTab !== 'all' &&
      currentTab !== 'fav' &&
      !newGroups.find((g) => g.id === currentTab)
    ) {
      setCurrentTab('all');
    }
  };

  const addFundsToCurrentGroup = (codes) => {
    if (!codes || codes.length === 0) return 0;
    let addedCount = 0;
    const next = groups.map((g) => {
      if (g.id === currentTab) {
        const beforeSize = g.codes.length;
        const merged = Array.from(new Set([...g.codes, ...codes]));
        if (merged.length > beforeSize) {
          addedCount += merged.length - beforeSize;
        }
        return {
          ...g,
          codes: merged,
        };
      }
      return g;
    });
    setGroups(next);
    syncService.save(DATA_KEYS.GROUPS, next);
    return addedCount;
  };

  const removeFundFromCurrentGroup = (code) => {
    const next = groups.map((g) => {
      if (g.id === currentTab) {
        return {
          ...g,
          codes: g.codes.filter((c) => c !== code),
        };
      }
      return g;
    });
    setGroups(next);
    syncService.save(DATA_KEYS.GROUPS, next);
  };

  const toggleFundInGroup = (code, groupId) => {
    const next = groups.map((g) => {
      if (g.id === groupId) {
        const has = g.codes.includes(code);
        return {
          ...g,
          codes: has ? g.codes.filter((c) => c !== code) : [...g.codes, code],
        };
      }
      return g;
    });
    setGroups(next);
    syncService.save(DATA_KEYS.GROUPS, next);
  };

  const setViewModeAndPersist = (mode) => {
    setViewMode(mode);
    syncService.save(DATA_KEYS.VIEW_MODE, mode);
  };

  return {
    collapsedCodes,
    setCollapsedCodes,
    favorites,
    setFavorites,
    groups,
    setGroups,
    currentTab,
    setCurrentTab,
    viewMode,
    setViewMode: setViewModeAndPersist,
    toggleFavorite,
    toggleCollapse,
    addGroup,
    removeGroup,
    updateGroups,
    addFundsToCurrentGroup,
    removeFundFromCurrentGroup,
    toggleFundInGroup,
  };
};


