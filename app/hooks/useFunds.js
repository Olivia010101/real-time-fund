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

// 获取今天日期字符串 (YYYY-MM-DD)
const getTodayString = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
};

// 判断是否为交易日
const isTradeDay = () => {
  const now = new Date();
  const day = now.getDay();
  // 周六日不是交易日
  if (day === 0 || day === 6) return false;
  return true;
};

// 判断当前是否在交易时段 (9:30 - 15:00)
const isTradeTime = () => {
  if (!isTradeDay()) return false;
  const now = new Date();
  const hours = now.getHours();
  const minutes = now.getMinutes();
  const timeInMinutes = hours * 60 + minutes;
  // 9:30 = 570, 15:00 = 900
  return timeInMinutes >= 570 && timeInMinutes <= 900;
};

// 日内估值数据键名
const INTRADAY_KEY = 'intraday_data';

// 获取日内估值数据
const getIntradayData = () => {
  try {
    const saved = localStorage.getItem(INTRADAY_KEY);
    if (!saved) return {};
    return JSON.parse(saved);
  } catch {
    return {};
  }
};

// 保存日内估值数据
const saveIntradayData = (data) => {
  try {
    localStorage.setItem(INTRADAY_KEY, JSON.stringify(data));
  } catch (e) {
    console.error('保存日内估值数据失败', e);
  }
};

// 清理非当天的数据
const cleanupOldIntradayData = () => {
  const today = getTodayString();
  const data = getIntradayData();
  let hasChanges = false;
  
  Object.keys(data).forEach(date => {
    if (date !== today) {
      delete data[date];
      hasChanges = true;
    }
  });
  
  if (hasChanges) {
    saveIntradayData(data);
  }
  
  return data[today] || {};
};

export const useFunds = () => {
  const [funds, setFunds] = useState([]);
  const [refreshMs, setRefreshMs] = useState(30000);
  const [refreshing, setRefreshing] = useState(false);
  const [positions, setPositions] = useState({});
  const [intradayData, setIntradayData] = useState({});

  const timerRef = useRef(null);
  const refreshingRef = useRef(false);
  const intradayDataRef = useRef({});

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
          
          // 记录日内估值数据（只在交易时段内记录）
          if (isTradeTime()) {
            const today = getTodayString();
            const currentData = { ...intradayDataRef.current };
            
            updated.forEach((fund) => {
              const code = fund.code;
              if (!currentData[code]) {
                currentData[code] = [];
              }
              
              const now = new Date();
              const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
              
              // 获取当前估值
              const value = fund.estPricedCoverage > 0.05 
                ? Number(fund.estGsz) 
                : Number.isFinite(Number(fund.gsz)) 
                  ? Number(fund.gsz) 
                  : Number(fund.dwjz);
              
              const change = fund.estPricedCoverage > 0.05 
                ? fund.estGszzl 
                : Number(fund.gszzl) || 0;
              
              // 避免重复记录（一分钟内只记录一次）
              const lastPoint = currentData[code][currentData[code].length - 1];
              if (!lastPoint || lastPoint.time !== timeStr) {
                currentData[code].push({
                  time: timeStr,
                  value: Number(value.toFixed(4)),
                  change: Number(change.toFixed(2)),
                  timestamp: now.getTime(),
                });
                
                // 限制最多500个点（防止意外情况）
                if (currentData[code].length > 500) {
                  currentData[code] = currentData[code].slice(-500);
                }
              }
            });
            
            // 保存到localStorage
            const allData = getIntradayData();
            allData[today] = currentData;
            saveIntradayData(allData);
            intradayDataRef.current = currentData;
            setIntradayData(currentData);
          }
          
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

        // 加载并清理日内估值数据（只保留当天）
        const todayData = cleanupOldIntradayData();
        setIntradayData(todayData);
        intradayDataRef.current = todayData;
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
    intradayData,
    setIntradayData,
  };
};


