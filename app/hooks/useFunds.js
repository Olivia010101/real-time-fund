'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchFundData } from '../lib/fundApi';
import { syncService, DATA_KEYS } from '../lib/syncService';

// 按 code 去重，保留第一次出现的项，避免列表重复
const dedupeByCode = (list) => {
  const seen = new Set();
  return list.filter((f) => {
    const c = f?.code;
    if (!c || seen.has(c)) return false;
    seen.add(c);
    return true;
  });
};

export const useFunds = () => {
  const [funds, setFunds] = useState([]);
  const [refreshMs, setRefreshMs] = useState(30000);
  const [refreshing, setRefreshing] = useState(false);
  const [positions, setPositions] = useState({});

  const timerRef = useRef(null);
  const refreshingRef = useRef(false);

  const refreshAll = useCallback(
    async (codes) => {
      if (refreshingRef.current) return;
      refreshingRef.current = true;
      setRefreshing(true);
      const uniqueCodes = Array.from(new Set(codes));
      try {
        const updated = [];
        for (const c of uniqueCodes) {
          try {
            const data = await fetchFundData(c);
            updated.push(data);
          } catch (e) {
            console.error(`刷新基金 ${c} 失败`, e);
            // 失败时从当前 state 中寻找旧数据
            setFunds((prev) => {
              const old = prev.find((f) => f.code === c);
              if (old) updated.push(old);
              return prev;
            });
          }
        }

        if (updated.length > 0) {
          setFunds((prev) => {
            // 将更新后的数据合并回当前最新的 state 中，防止覆盖掉刚刚导入的数据
            const merged = [...prev];
            updated.forEach((u) => {
              const idx = merged.findIndex((f) => f.code === u.code);
              if (idx > -1) {
                merged[idx] = u;
              } else {
                merged.push(u);
              }
            });
            const deduped = dedupeByCode(merged);
            syncService.save(DATA_KEYS.FUNDS, deduped);
            return deduped;
          });
        }
      } catch (e) {
        console.error(e);
      } finally {
        refreshingRef.current = false;
        setRefreshing(false);
      }
    },
    []
  );

  // 初始化：从本地/云端读取基金列表、刷新频率和持仓，并触发一次刷新
  useEffect(() => {
    const loadData = async () => {
      try {
        // 从同步服务加载数据（会尝试从云端同步）
        const saved = await syncService.load(DATA_KEYS.FUNDS, []);
        if (Array.isArray(saved) && saved.length) {
          const deduped = dedupeByCode(saved);
          setFunds(deduped);
          const codes = Array.from(new Set(deduped.map((f) => f.code)));
          if (codes.length) refreshAll(codes);
        }
        
        const savedMs = await syncService.load(DATA_KEYS.REFRESH_MS, 30000);
        if (Number.isFinite(savedMs) && savedMs >= 5000) {
          setRefreshMs(savedMs);
        }
        
        // 加载持仓信息
        const savedPositions = await syncService.load(DATA_KEYS.POSITIONS, {});
        if (savedPositions && typeof savedPositions === 'object') {
          setPositions(savedPositions);
        }
      } catch {
        // ignore
      }
    };
    
    loadData();
  }, [refreshAll]);

  // 定时刷新
  useEffect(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      const codes = Array.from(new Set(funds.map((f) => f.code)));
      if (codes.length) refreshAll(codes);
    }, refreshMs);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [funds, refreshMs, refreshAll]);

  const manualRefresh = useCallback(async () => {
    if (refreshingRef.current) return;
    const codes = Array.from(new Set(funds.map((f) => f.code)));
    if (!codes.length) return;
    await refreshAll(codes);
  }, [funds, refreshAll]);

  const updateRefreshMs = useCallback((ms) => {
    setRefreshMs(ms);
    syncService.save(DATA_KEYS.REFRESH_MS, ms);
  }, []);

  return {
    funds,
    setFunds,
    refreshMs,
    updateRefreshMs,
    refreshing,
    manualRefresh,
    refreshAll,
    positions,
    setPositions,
    dedupeByCode,
  };
};


