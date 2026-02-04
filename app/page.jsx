'use client';

import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Announcement from "./components/Announcement";
import Navbar from "./components/Navbar";
import FundFilterBar from "./components/FundFilterBar";
import SettingsModal from "./components/SettingsModal";
import {
  PlusIcon,
  TrashIcon,
  SettingsIcon,
  RefreshIcon,
  ChevronIcon,
  SortIcon,
  GridIcon,
  CloseIcon,
  ExitIcon,
  ListIcon,
  DragIcon,
  FolderPlusIcon,
  StarIcon,
} from "./components/Icons";
import Stat from "./components/Stat";
import FeedbackModal from "./components/modals/FeedbackModal";
import AddResultModal from "./components/modals/AddResultModal";
import SuccessModal from "./components/modals/SuccessModal";
import ConfirmModal from "./components/modals/ConfirmModal";
import GroupManageModal from "./components/modals/GroupManageModal";
import AddFundToGroupModal from "./components/modals/AddFundToGroupModal";
import GroupModal from "./components/modals/GroupModal";
import PositionModal from "./components/modals/PositionModal";

export default function HomePage() {
  const [funds, setFunds] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const timerRef = useRef(null);
  const refreshingRef = useRef(false);

  // 刷新频率状态
  const [refreshMs, setRefreshMs] = useState(30000);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [tempSeconds, setTempSeconds] = useState(30);

  // 全局刷新状态
  const [refreshing, setRefreshing] = useState(false);

  // 收起/展开状态
  const [collapsedCodes, setCollapsedCodes] = useState(new Set());

  // 自选状态
  const [favorites, setFavorites] = useState(new Set());
  const [groups, setGroups] = useState([]); // [{ id, name, codes: [] }]
  const [currentTab, setCurrentTab] = useState('all');
  const [groupModalOpen, setGroupModalOpen] = useState(false);
  const [groupManageOpen, setGroupManageOpen] = useState(false);
  const [addFundToGroupOpen, setAddFundToGroupOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState(null);

  // 持仓信息：按基金 code 存储
  const [positions, setPositions] = useState({});
  const [editingPositionFund, setEditingPositionFund] = useState(null);

  // 排序状态
  const [sortBy, setSortBy] = useState('default'); // default, name, yield, code

  // 视图模式
  const [viewMode, setViewMode] = useState('card'); // card, list

  // 反馈弹窗状态
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [feedbackNonce, setFeedbackNonce] = useState(0);

  // 搜索相关状态
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [selectedFunds, setSelectedFunds] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const searchTimeoutRef = useRef(null);
  const dropdownRef = useRef(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const [addResultOpen, setAddResultOpen] = useState(false);
  const [addFailures, setAddFailures] = useState([]);
  // tabs 滚动逻辑已封装到 FundFilterBar 中

  // 过滤和排序后的基金列表
  const displayFunds = funds
    .filter(f => {
      if (currentTab === 'all') return true;
      if (currentTab === 'fav') return favorites.has(f.code);
      const group = groups.find(g => g.id === currentTab);
      return group ? group.codes.includes(f.code) : true;
    })
    .sort((a, b) => {
      if (sortBy === 'yield') {
        const valA = typeof a.estGszzl === 'number' ? a.estGszzl : (Number(a.gszzl) || 0);
        const valB = typeof b.estGszzl === 'number' ? b.estGszzl : (Number(b.gszzl) || 0);
        return valB - valA;
      }
      if (sortBy === 'recentYield') {
        const getCurrentPrice = (f) => {
          if (f.estPricedCoverage > 0.05) return Number(f.estGsz);
          if (Number.isFinite(Number(f.gsz))) return Number(f.gsz);
          return Number(f.dwjz);
        };
        const calcRecentYield = (f) => {
          const pos = positions[f.code];
          const p = getCurrentPrice(f);
          if (!pos || !pos.lastTradeNav || !Number.isFinite(p) || p <= 0 || pos.lastTradeNav <= 0) return -Infinity;
          return (p / pos.lastTradeNav - 1) * 100;
        };
        const valA = calcRecentYield(a);
        const valB = calcRecentYield(b);
        return valB - valA;
      }
      if (sortBy === 'name') return a.name.localeCompare(b.name, 'zh-CN');
      if (sortBy === 'code') return a.code.localeCompare(b.code);
      return 0;
    });

  // 成功提示弹窗
  const [successModal, setSuccessModal] = useState({ open: false, message: '' });

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const toggleFavorite = (code) => {
    setFavorites(prev => {
      const next = new Set(prev);
      if (next.has(code)) {
        next.delete(code);
      } else {
        next.add(code);
      }
      localStorage.setItem('favorites', JSON.stringify(Array.from(next)));
      if (next.size === 0) setCurrentTab('all');
      return next;
    });
  };

  const toggleCollapse = (code) => {
    setCollapsedCodes(prev => {
      const next = new Set(prev);
      if (next.has(code)) {
        next.delete(code);
      } else {
        next.add(code);
      }
      // 同步到本地存储
      localStorage.setItem('collapsedCodes', JSON.stringify(Array.from(next)));
      return next;
    });
  };

  const handleAddGroup = (name) => {
    const newGroup = {
      id: `group_${Date.now()}`,
      name,
      codes: []
    };
    const next = [...groups, newGroup];
    setGroups(next);
    localStorage.setItem('groups', JSON.stringify(next));
    setCurrentTab(newGroup.id);
    setGroupModalOpen(false);
  };

  const handleRemoveGroup = (id) => {
    const next = groups.filter(g => g.id !== id);
    setGroups(next);
    localStorage.setItem('groups', JSON.stringify(next));
    if (currentTab === id) setCurrentTab('all');
  };

  const handleUpdateGroups = (newGroups) => {
    setGroups(newGroups);
    localStorage.setItem('groups', JSON.stringify(newGroups));
    // 如果当前选中的分组被删除了，切换回“全部”
    if (currentTab !== 'all' && currentTab !== 'fav' && !newGroups.find(g => g.id === currentTab)) {
      setCurrentTab('all');
    }
  };

  const handleAddFundsToGroup = (codes) => {
    if (!codes || codes.length === 0) return;
    const next = groups.map(g => {
      if (g.id === currentTab) {
        return {
          ...g,
          codes: Array.from(new Set([...g.codes, ...codes]))
        };
      }
      return g;
    });
    setGroups(next);
    localStorage.setItem('groups', JSON.stringify(next));
    setAddFundToGroupOpen(false);
    setSuccessModal({ open: true, message: `成功添加 ${codes.length} 支基金` });
  };

  const removeFundFromCurrentGroup = (code) => {
    const next = groups.map(g => {
      if (g.id === currentTab) {
        return {
          ...g,
          codes: g.codes.filter(c => c !== code)
        };
      }
      return g;
    });
    setGroups(next);
    localStorage.setItem('groups', JSON.stringify(next));
  };

  const toggleFundInGroup = (code, groupId) => {
    const next = groups.map(g => {
      if (g.id === groupId) {
        const has = g.codes.includes(code);
        return {
          ...g,
          codes: has ? g.codes.filter(c => c !== code) : [...g.codes, code]
        };
      }
      return g;
    });
    setGroups(next);
    localStorage.setItem('groups', JSON.stringify(next));
  };

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

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('funds') || '[]');
      if (Array.isArray(saved) && saved.length) {
        const deduped = dedupeByCode(saved);
        setFunds(deduped);
        localStorage.setItem('funds', JSON.stringify(deduped));
        const codes = Array.from(new Set(deduped.map((f) => f.code)));
        if (codes.length) refreshAll(codes);
      }
      const savedMs = parseInt(localStorage.getItem('refreshMs') || '30000', 10);
      if (Number.isFinite(savedMs) && savedMs >= 5000) {
        setRefreshMs(savedMs);
        setTempSeconds(Math.round(savedMs / 1000));
      }
      // 加载收起状态
      const savedCollapsed = JSON.parse(localStorage.getItem('collapsedCodes') || '[]');
      if (Array.isArray(savedCollapsed)) {
        setCollapsedCodes(new Set(savedCollapsed));
      }
      // 加载自选状态
      const savedFavorites = JSON.parse(localStorage.getItem('favorites') || '[]');
      if (Array.isArray(savedFavorites)) {
        setFavorites(new Set(savedFavorites));
      }
      // 加载分组状态
      const savedGroups = JSON.parse(localStorage.getItem('groups') || '[]');
      if (Array.isArray(savedGroups)) {
        setGroups(savedGroups);
      }
      // 加载视图模式
      const savedViewMode = localStorage.getItem('viewMode');
      if (savedViewMode === 'card' || savedViewMode === 'list') {
        setViewMode(savedViewMode);
      }
      // 加载持仓信息
      const savedPositions = JSON.parse(localStorage.getItem('positions') || '{}');
      if (savedPositions && typeof savedPositions === 'object') {
        setPositions(savedPositions);
      }
    } catch {}
  }, []);

  // 默认收起前 10 重仓股票：初始时将所有已存在基金 code 加入 collapsedCodes
  useEffect(() => {
    if (!funds.length) return;
    setCollapsedCodes(prev => {
      const next = new Set(prev);
      let changed = false;
      funds.forEach((f) => {
        if (f && f.code && !next.has(f.code)) {
          next.add(f.code);
          changed = true;
        }
      });
      if (changed) {
        localStorage.setItem('collapsedCodes', JSON.stringify(Array.from(next)));
      }
      return changed ? next : prev;
    });
  }, [funds]);

  useEffect(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      const codes = Array.from(new Set(funds.map((f) => f.code)));
      if (codes.length) refreshAll(codes);
    }, refreshMs);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [funds, refreshMs]);

  // --- 辅助：JSONP 数据抓取逻辑 ---
  const loadScript = (url) => {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = url;
      script.async = true;
      script.onload = () => {
        document.body.removeChild(script);
        resolve();
      };
      script.onerror = () => {
        document.body.removeChild(script);
        reject(new Error('数据加载失败'));
      };
      document.body.appendChild(script);
    });
  };

  const fetchFundData = async (c) => {
    return new Promise(async (resolve, reject) => {
      // 腾讯接口识别逻辑优化
      const getTencentPrefix = (code) => {
        if (code.startsWith('6') || code.startsWith('9')) return 'sh';
        if (code.startsWith('0') || code.startsWith('3')) return 'sz';
        if (code.startsWith('4') || code.startsWith('8')) return 'bj';
        return 'sz';
      };

      const gzUrl = `https://fundgz.1234567.com.cn/js/${c}.js?rt=${Date.now()}`;

      // 使用更安全的方式处理全局回调，避免并发覆盖
      const currentCallback = `jsonpgz_${c}_${Math.random().toString(36).slice(2, 7)}`;

      // 动态拦截并处理 jsonpgz 回调
      const scriptGz = document.createElement('script');
      // 东方财富接口固定调用 jsonpgz，我们通过修改全局变量临时捕获它
      scriptGz.src = gzUrl;

      const originalJsonpgz = window.jsonpgz;
      window.jsonpgz = (json) => {
        window.jsonpgz = originalJsonpgz; // 立即恢复
        if (!json || typeof json !== 'object') {
          reject(new Error('未获取到基金估值数据'));
          return;
        }
        const gszzlNum = Number(json.gszzl);
        const gzData = {
          code: json.fundcode,
          name: json.name,
          dwjz: json.dwjz,
          gsz: json.gsz,
          gztime: json.gztime,
          gszzl: Number.isFinite(gszzlNum) ? gszzlNum : json.gszzl
        };

        // 获取重仓股票列表
        const holdingsUrl = `https://fundf10.eastmoney.com/FundArchivesDatas.aspx?type=jjcc&code=${c}&topline=10&year=&month=&rt=${Date.now()}`;
        loadScript(holdingsUrl).then(async () => {
          let holdings = [];
          const html = window.apidata?.content || '';
          const rows = html.match(/<tr[\s\S]*?<\/tr>/gi) || [];
          for (const r of rows) {
            const cells = (r.match(/<td[\s\S]*?>([\s\S]*?)<\/td>/gi) || []).map(td => td.replace(/<[^>]*>/g, '').trim());
            const codeIdx = cells.findIndex(txt => /^\d{6}$/.test(txt));
            const weightIdx = cells.findIndex(txt => /\d+(?:\.\d+)?\s*%/.test(txt));
            if (codeIdx >= 0 && weightIdx >= 0) {
              holdings.push({
                code: cells[codeIdx],
                name: cells[codeIdx + 1] || '',
                weight: cells[weightIdx],
                change: null
              });
            }
          }

          holdings = holdings.slice(0, 10);

          if (holdings.length) {
            try {
              const tencentCodes = holdings.map(h => `s_${getTencentPrefix(h.code)}${h.code}`).join(',');
              const quoteUrl = `https://qt.gtimg.cn/q=${tencentCodes}`;

              await new Promise((resQuote) => {
                const scriptQuote = document.createElement('script');
                scriptQuote.src = quoteUrl;
                scriptQuote.onload = () => {
                  holdings.forEach(h => {
                    const varName = `v_s_${getTencentPrefix(h.code)}${h.code}`;
                    const dataStr = window[varName];
                    if (dataStr) {
                      const parts = dataStr.split('~');
                      // parts[5] 是涨跌幅
                      if (parts.length > 5) {
                        h.change = parseFloat(parts[5]);
                      }
                    }
                  });
                  if (document.body.contains(scriptQuote)) document.body.removeChild(scriptQuote);
                  resQuote();
                };
                scriptQuote.onerror = () => {
                  if (document.body.contains(scriptQuote)) document.body.removeChild(scriptQuote);
                  resQuote();
                };
                document.body.appendChild(scriptQuote);
              });
            } catch (e) {
              console.error('获取股票涨跌幅失败', e);
            }
          }

          resolve({ ...gzData, holdings });
        }).catch(() => resolve({ ...gzData, holdings: [] }));
      };

      scriptGz.onerror = () => {
        window.jsonpgz = originalJsonpgz;
        if (document.body.contains(scriptGz)) document.body.removeChild(scriptGz);
        reject(new Error('基金数据加载失败'));
      };

      document.body.appendChild(scriptGz);
      // 加载完立即移除脚本
      setTimeout(() => {
        if (document.body.contains(scriptGz)) document.body.removeChild(scriptGz);
      }, 5000);
    });
  };

  const performSearch = async (val) => {
    if (!val.trim()) {
      setSearchResults([]);
      return;
    }
    setIsSearching(true);
    // 使用 JSONP 方式获取数据，添加 callback 参数
    const callbackName = `SuggestData_${Date.now()}`;
    const url = `https://fundsuggest.eastmoney.com/FundSearch/api/FundSearchAPI.ashx?m=1&key=${encodeURIComponent(val)}&callback=${callbackName}&_=${Date.now()}`;
    
    try {
      await new Promise((resolve, reject) => {
        window[callbackName] = (data) => {
          if (data && data.Datas) {
            // 过滤出基金类型的数据 (CATEGORY 为 700 是公募基金)
            const fundsOnly = data.Datas.filter(d => 
              d.CATEGORY === 700 || 
              d.CATEGORY === "700" || 
              d.CATEGORYDESC === "基金"
            );
            setSearchResults(fundsOnly);
          }
          delete window[callbackName];
          resolve();
        };

        const script = document.createElement('script');
        script.src = url;
        script.async = true;
        script.onload = () => {
          if (document.body.contains(script)) document.body.removeChild(script);
        };
        script.onerror = () => {
          if (document.body.contains(script)) document.body.removeChild(script);
          delete window[callbackName];
          reject(new Error('搜索请求失败'));
        };
        document.body.appendChild(script);
      });
    } catch (e) {
      console.error('搜索失败', e);
    } finally {
      setIsSearching(false);
    }
  };

  const handleSearchInput = (e) => {
    const val = e.target.value;
    setSearchTerm(val);
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    searchTimeoutRef.current = setTimeout(() => performSearch(val), 300);
  };

  const toggleSelectFund = (fund) => {
    setSelectedFunds(prev => {
      const exists = prev.find(f => f.CODE === fund.CODE);
      if (exists) {
        return prev.filter(f => f.CODE !== fund.CODE);
      }
      return [...prev, fund];
    });
  };

  const batchAddFunds = async () => {
    if (selectedFunds.length === 0) return;
    setLoading(true);
    setError('');
    
    try {
      const newFunds = [];
      for (const f of selectedFunds) {
        if (funds.some(existing => existing.code === f.CODE)) continue;
        try {
          const data = await fetchFundData(f.CODE);
          newFunds.push(data);
        } catch (e) {
          console.error(`添加基金 ${f.CODE} 失败`, e);
        }
      }
      
      if (newFunds.length > 0) {
        const updated = dedupeByCode([...newFunds, ...funds]);
        setFunds(updated);
        localStorage.setItem('funds', JSON.stringify(updated));
      }
      
      setSelectedFunds([]);
      setSearchTerm('');
      setSearchResults([]);
    } catch (e) {
      setError('批量添加失败');
    } finally {
      setLoading(false);
    }
  };

  const refreshAll = async (codes) => {
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
          setFunds(prev => {
            const old = prev.find((f) => f.code === c);
            if (old) updated.push(old);
            return prev;
          });
        }
      }
      
      if (updated.length > 0) {
        setFunds(prev => {
          // 将更新后的数据合并回当前最新的 state 中，防止覆盖掉刚刚导入的数据
          const merged = [...prev];
          updated.forEach(u => {
            const idx = merged.findIndex(f => f.code === u.code);
            if (idx > -1) {
              merged[idx] = u;
            } else {
              merged.push(u);
            }
          });
          const deduped = dedupeByCode(merged);
          localStorage.setItem('funds', JSON.stringify(deduped));
          return deduped;
        });
      }
    } catch (e) {
      console.error(e);
    } finally {
      refreshingRef.current = false;
      setRefreshing(false);
    }
  };

  const toggleViewMode = () => {
    const nextMode = viewMode === 'card' ? 'list' : 'card';
    setViewMode(nextMode);
    localStorage.setItem('viewMode', nextMode);
  };

  const addFund = async (e) => {
    e?.preventDefault?.();
    setError('');
    const manualTokens = String(searchTerm || '')
      .split(/[^0-9A-Za-z]+/)
      .map(t => t.trim())
      .filter(t => t.length > 0);
    const selectedCodes = Array.from(new Set([
      ...selectedFunds.map(f => f.CODE),
      ...manualTokens.filter(t => /^\d{6}$/.test(t))
    ]));
    if (selectedCodes.length === 0) {
      setError('请输入或选择基金代码');
      return;
    }
    setLoading(true);
    try {
      const newFunds = [];
      const failures = [];
      const nameMap = {};
      selectedFunds.forEach(f => { nameMap[f.CODE] = f.NAME; });
      for (const c of selectedCodes) {
        if (funds.some((f) => f.code === c)) continue;
        try {
          const data = await fetchFundData(c);
          newFunds.push(data);
        } catch (err) {
          failures.push({ code: c, name: nameMap[c] });
        }
      }
      if (newFunds.length === 0) {
        setError('未添加任何新基金');
      } else {
        const next = dedupeByCode([...newFunds, ...funds]);
        setFunds(next);
        localStorage.setItem('funds', JSON.stringify(next));
      }
      setSearchTerm('');
      setSelectedFunds([]);
      setShowDropdown(false);
      if (failures.length > 0) {
        setAddFailures(failures);
        setAddResultOpen(true);
      }
    } catch (e) {
      setError(e.message || '添加失败');
    } finally {
      setLoading(false);
    }
  };

  const removeFund = (removeCode) => {
    const next = funds.filter((f) => f.code !== removeCode);
    setFunds(next);
    localStorage.setItem('funds', JSON.stringify(next));

    // 同步删除分组中的失效代码
    const nextGroups = groups.map(g => ({
      ...g,
      codes: g.codes.filter(c => c !== removeCode)
    }));
    setGroups(nextGroups);
    localStorage.setItem('groups', JSON.stringify(nextGroups));

    // 同步删除展开收起状态
    setCollapsedCodes(prev => {
      if (!prev.has(removeCode)) return prev;
      const nextSet = new Set(prev);
      nextSet.delete(removeCode);
      localStorage.setItem('collapsedCodes', JSON.stringify(Array.from(nextSet)));
      return nextSet;
    });

    // 同步删除自选状态
    setFavorites(prev => {
      if (!prev.has(removeCode)) return prev;
      const nextSet = new Set(prev);
      nextSet.delete(removeCode);
      localStorage.setItem('favorites', JSON.stringify(Array.from(nextSet)));
      if (nextSet.size === 0) setCurrentTab('all');
      return nextSet;
    });
  };

  const [deleteFundConfirm, setDeleteFundConfirm] = useState(null); // { code, name }

  const manualRefresh = async () => {
    if (refreshingRef.current) return;
    const codes = Array.from(new Set(funds.map((f) => f.code)));
    if (!codes.length) return;
    await refreshAll(codes);
  };

  const saveSettings = (e) => {
    e?.preventDefault?.();
    const ms = Math.max(5, Number(tempSeconds)) * 1000;
    setRefreshMs(ms);
    localStorage.setItem('refreshMs', String(ms));
    setSettingsOpen(false);
  };

  const importFileRef = useRef(null);
  const [importMsg, setImportMsg] = useState('');

  const exportLocalData = async () => {
    try {
      const payload = {
        version: 1,
        funds: JSON.parse(localStorage.getItem('funds') || '[]'),
        favorites: JSON.parse(localStorage.getItem('favorites') || '[]'),
        groups: JSON.parse(localStorage.getItem('groups') || '[]'),
        collapsedCodes: JSON.parse(localStorage.getItem('collapsedCodes') || '[]'),
        refreshMs: parseInt(localStorage.getItem('refreshMs') || '30000', 10),
        viewMode: localStorage.getItem('viewMode') || 'card',
        exportedAt: new Date().toISOString()
      };
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      if (window.showSaveFilePicker) {
        const handle = await window.showSaveFilePicker({
          suggestedName: `realtime-fund-config-${Date.now()}.json`,
          types: [{ description: 'JSON', accept: { 'application/json': ['.json'] } }]
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
        // 从 localStorage 读取最新数据进行合并，防止状态滞后导致的数据丢失
        const currentFunds = JSON.parse(localStorage.getItem('funds') || '[]');
        const currentFavorites = JSON.parse(localStorage.getItem('favorites') || '[]');
        const currentGroups = JSON.parse(localStorage.getItem('groups') || '[]');
        const currentCollapsed = JSON.parse(localStorage.getItem('collapsedCodes') || '[]');

        let mergedFunds = currentFunds;
        let appendedCodes = [];

        if (Array.isArray(data.funds)) {
          const incomingFunds = dedupeByCode(data.funds);
          const existingCodes = new Set(currentFunds.map(f => f.code));
          const newItems = incomingFunds.filter(f => f && f.code && !existingCodes.has(f.code));
          appendedCodes = newItems.map(f => f.code);
          mergedFunds = [...currentFunds, ...newItems];
          setFunds(mergedFunds);
          localStorage.setItem('funds', JSON.stringify(mergedFunds));
        }

        if (Array.isArray(data.favorites)) {
          const mergedFav = Array.from(new Set([...currentFavorites, ...data.favorites]));
          setFavorites(new Set(mergedFav));
          localStorage.setItem('favorites', JSON.stringify(mergedFav));
        }

        if (Array.isArray(data.groups)) {
          // 合并分组：如果 ID 相同则合并 codes，否则添加新分组
          const mergedGroups = [...currentGroups];
          data.groups.forEach(incomingGroup => {
            const existingIdx = mergedGroups.findIndex(g => g.id === incomingGroup.id);
            if (existingIdx > -1) {
              mergedGroups[existingIdx] = {
                ...mergedGroups[existingIdx],
                codes: Array.from(new Set([...mergedGroups[existingIdx].codes, ...(incomingGroup.codes || [])]))
              };
            } else {
              mergedGroups.push(incomingGroup);
            }
          });
          setGroups(mergedGroups);
          localStorage.setItem('groups', JSON.stringify(mergedGroups));
        }

        if (Array.isArray(data.collapsedCodes)) {
          const mergedCollapsed = Array.from(new Set([...currentCollapsed, ...data.collapsedCodes]));
          setCollapsedCodes(new Set(mergedCollapsed));
          localStorage.setItem('collapsedCodes', JSON.stringify(mergedCollapsed));
        }

        if (typeof data.refreshMs === 'number' && data.refreshMs >= 5000) {
          setRefreshMs(data.refreshMs);
          setTempSeconds(Math.round(data.refreshMs / 1000));
          localStorage.setItem('refreshMs', String(data.refreshMs));
        }
        if (data.viewMode === 'card' || data.viewMode === 'list') {
          setViewMode(data.viewMode);
          localStorage.setItem('viewMode', data.viewMode);
        }

        // 兼容导入持仓信息（如果存在）
        if (data.positions && typeof data.positions === 'object') {
          const mergedPositions = { ...(JSON.parse(localStorage.getItem('positions') || '{}') || {}), ...data.positions };
          setPositions(mergedPositions);
          localStorage.setItem('positions', JSON.stringify(mergedPositions));
        }

        // 导入成功后，仅刷新新追加的基金
        if (appendedCodes.length) {
          // 这里需要确保 refreshAll 不会因为闭包问题覆盖掉刚刚合并好的 mergedFunds
          // 我们直接传入所有代码执行一次全量刷新是最稳妥的，或者修改 refreshAll 支持增量更新
          const allCodes = mergedFunds.map(f => f.code);
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

  useEffect(() => {
    const isAnyModalOpen = 
      settingsOpen || 
      feedbackOpen || 
      addResultOpen || 
      addFundToGroupOpen || 
      groupManageOpen || 
      groupModalOpen || 
      successModal.open ||
      !!editingPositionFund;
    
    if (isAnyModalOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    
    return () => {
      document.body.style.overflow = '';
    };
  }, [settingsOpen, feedbackOpen, addResultOpen, addFundToGroupOpen, groupManageOpen, groupModalOpen, successModal.open, editingPositionFund]);

  useEffect(() => {
    const onKey = (ev) => {
      if (ev.key === 'Escape' && settingsOpen) setSettingsOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [settingsOpen]);

  return (
    <div className="container content">
      <Announcement />
      <Navbar
        refreshMs={refreshMs}
        refreshing={refreshing}
        hasFunds={funds.length > 0}
        onManualRefresh={manualRefresh}
        onOpenSettings={() => setSettingsOpen(true)}
      />

      <div className="grid">
        <div className="col-12 glass card add-fund-section" role="region" aria-label="添加基金">
          <div className="title" style={{ marginBottom: 12 }}>
            <PlusIcon width="20" height="20" />
            <span>添加基金</span>
            <span className="muted">搜索并选择基金（支持名称或代码）</span>
          </div>
          
          <div className="search-container" ref={dropdownRef}>
            <form className="form" onSubmit={addFund}>
              <div className="search-input-wrapper" style={{ flex: 1, gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                {selectedFunds.length > 0 && (
                  <div className="selected-inline-chips">
                    {selectedFunds.map(fund => (
                      <div key={fund.CODE} className="fund-chip">
                        <span>{fund.NAME}</span>
                        <button onClick={() => toggleSelectFund(fund)} className="remove-chip">
                          <CloseIcon width="14" height="14" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                <input
                  className="input"
                  placeholder="搜索基金名称或代码..."
                  value={searchTerm}
                  onChange={handleSearchInput}
                  onFocus={() => setShowDropdown(true)}
                />
                {isSearching && <div className="search-spinner" />}
              </div>
              <button className="button" type="submit" disabled={loading}>
                {loading ? '添加中…' : '添加'}
              </button>
            </form>

            <AnimatePresence>
              {showDropdown && (searchTerm.trim() || searchResults.length > 0) && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="search-dropdown glass"
                >
                  {searchResults.length > 0 ? (
                    <div className="search-results">
                      {searchResults.map((fund) => {
                        const isSelected = selectedFunds.some(f => f.CODE === fund.CODE);
                        const isAlreadyAdded = funds.some(f => f.code === fund.CODE);
                        return (
                          <div
                            key={fund.CODE}
                            className={`search-item ${isSelected ? 'selected' : ''} ${isAlreadyAdded ? 'added' : ''}`}
                            onClick={() => {
                              if (isAlreadyAdded) return;
                              toggleSelectFund(fund);
                            }}
                          >
                            <div className="fund-info">
                              <span className="fund-name">{fund.NAME}</span>
                              <span className="fund-code muted">#{fund.CODE} | {fund.TYPE}</span>
                            </div>
                            {isAlreadyAdded ? (
                              <span className="added-label">已添加</span>
                            ) : (
                              <div className="checkbox">
                                {isSelected && <div className="checked-mark" />}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ) : searchTerm.trim() && !isSearching ? (
                    <div className="no-results muted">未找到相关基金</div>
                  ) : null}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          

          {error && <div className="muted" style={{ marginTop: 8, color: 'var(--danger)' }}>{error}</div>}
        </div>

        <div className="col-12">
          <FundFilterBar
            fundsCount={funds.length}
            favoritesCount={favorites.size}
            groups={groups}
            currentTab={currentTab}
            onChangeTab={setCurrentTab}
            viewMode={viewMode}
            onChangeViewMode={(mode) => {
              setViewMode(mode);
              localStorage.setItem('viewMode', mode);
            }}
            sortBy={sortBy}
            onChangeSortBy={setSortBy}
            onOpenGroupManage={() => setGroupManageOpen(true)}
            onOpenGroupModal={() => setGroupModalOpen(true)}
          />

          {displayFunds.length === 0 ? (
            <div className="glass card empty" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 20px' }}>
              <div style={{ fontSize: '48px', marginBottom: 16, opacity: 0.5 }}>📂</div>
              <div className="muted" style={{ marginBottom: 20 }}>{funds.length === 0 ? '尚未添加基金' : '该分组下暂无数据'}</div>
              {currentTab !== 'all' && currentTab !== 'fav' && funds.length > 0 && (
                <button className="button" onClick={() => setAddFundToGroupOpen(true)}>
                  添加基金到此分组
                </button>
              )}
            </div>
          ) : (
            <>
              {currentTab !== 'all' && currentTab !== 'fav' && (
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
                  <button 
                    className="button" 
                    onClick={() => setAddFundToGroupOpen(true)}
                    style={{ height: '32px', fontSize: '13px', padding: '0 12px', display: 'flex', alignItems: 'center', gap: '6px' }}
                  >
                    <PlusIcon width="16" height="16" />
                    <span>添加基金</span>
                  </button>
                </div>
              )}
              <AnimatePresence mode="wait">
              <motion.div
                key={viewMode}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
                className={viewMode === 'card' ? 'grid' : 'table-container glass'}
              >
                <div className={viewMode === 'card' ? 'grid col-12' : ''} style={viewMode === 'card' ? { gridColumn: 'span 12', gap: 16 } : {}}>
                  <AnimatePresence mode="popLayout">
                    {displayFunds.map((f) => (
                      <motion.div
                        layout="position"
                        key={f.code}
                        className={viewMode === 'card' ? 'col-6' : 'table-row-wrapper'}
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        transition={{ duration: 0.2 }}
                      >
                      <div className={viewMode === 'card' ? 'glass card' : 'table-row'}>
                        {viewMode === 'list' ? (
                          <>
                            <div className="table-cell name-cell">
                              {currentTab !== 'all' && currentTab !== 'fav' ? (
                                <button
                                  className="icon-button fav-button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    removeFundFromCurrentGroup(f.code);
                                  }}
                                  title="从当前分组移除"
                                >
                                  <ExitIcon width="18" height="18" style={{ transform: 'rotate(180deg)' }} />
                                </button>
                              ) : (
                                <button
                                  className={`icon-button fav-button ${favorites.has(f.code) ? 'active' : ''}`}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    toggleFavorite(f.code);
                                  }}
                                  title={favorites.has(f.code) ? "取消自选" : "添加自选"}
                                >
                                  <StarIcon width="18" height="18" filled={favorites.has(f.code)} />
                                </button>
                              )}
                              <div className="title-text">
                                <span className="name-text">{f.name}</span>
                                <span className="muted code-text">#{f.code}</span>
                              </div>
                            </div>
                            <div className="table-cell text-right value-cell">
                              <span style={{ fontWeight: 700 }}>
                                {f.estPricedCoverage > 0.05 ? f.estGsz.toFixed(4) : (f.gsz ?? '—')}
                              </span>
                            </div>
                            <div className="table-cell text-right change-cell">
                              <span
                                className={
                                  f.estPricedCoverage > 0.05
                                    ? f.estGszzl > 0
                                      ? 'up'
                                      : f.estGszzl < 0
                                      ? 'down'
                                      : ''
                                    : Number(f.gszzl) > 0
                                    ? 'up'
                                    : Number(f.gszzl) < 0
                                    ? 'down'
                                    : ''
                                }
                                style={{ fontWeight: 700 }}
                              >
                                {f.estPricedCoverage > 0.05
                                  ? `${f.estGszzl > 0 ? '+' : ''}${f.estGszzl.toFixed(2)}%`
                                  : typeof f.gszzl === 'number'
                                  ? `${f.gszzl > 0 ? '+' : ''}${f.gszzl.toFixed(2)}%`
                                  : f.gszzl ?? '—'}
                              </span>
                            </div>
                            <div className="table-cell text-right time-cell">
                              {(() => {
                                const pos = positions[f.code];
                                const currentPrice =
                                  f.estPricedCoverage > 0.05
                                    ? Number(f.estGsz)
                                    : Number.isFinite(Number(f.gsz))
                                    ? Number(f.gsz)
                                    : Number(f.dwjz);
                                const hasPos = pos && pos.shares > 0;
                                const value =
                                  hasPos && Number.isFinite(currentPrice) && currentPrice > 0
                                    ? (pos.shares * currentPrice).toFixed(2)
                                    : null;
                                const holdYield =
                                  hasPos && pos.costPrice > 0 && Number.isFinite(currentPrice) && currentPrice > 0
                                    ? ((currentPrice / pos.costPrice - 1) * 100).toFixed(2)
                                    : null;
                                return (
                                  <div style={{ textAlign: 'right', fontSize: '12px' }}>
                                    <div className="muted" style={{ fontSize: '11px' }}>
                                      {f.gztime || f.time || '-'}
                                    </div>
                                    {hasPos ? (
                                      <div style={{ marginTop: 2 }}>
                                        <span style={{ marginRight: 6 }}>
                                          {value ? `${value} 元` : '—'}
                                        </span>
                                        <span
                                          className={
                                            holdYield
                                              ? parseFloat(holdYield) > 0
                                                ? 'up'
                                                : parseFloat(holdYield) < 0
                                                ? 'down'
                                                : ''
                                              : ''
                                          }
                                        >
                                          {holdYield
                                            ? `${parseFloat(holdYield) > 0 ? '+' : ''}${holdYield}%`
                                            : '—'}
                                        </span>
                                      </div>
                                    ) : (
                                      <div className="muted" style={{ fontSize: '11px', marginTop: 2 }}>
                                        暂无持仓
                                      </div>
                                    )}
                                  </div>
                                );
                              })()}
                            </div>
                            <div className="table-cell text-center action-cell" style={{ gap: 4 }}>
                              <button
                                className="icon-button"
                                onClick={() => setEditingPositionFund(f)}
                                title="编辑持仓"
                                style={{ width: '28px', height: '28px' }}
                              >
                                <FolderPlusIcon width="14" height="14" />
                              </button>
                              <button
                                className="icon-button danger"
                                onClick={() => setDeleteFundConfirm({ code: f.code, name: f.name })}
                                title="删除"
                                style={{ width: '28px', height: '28px' }}
                              >
                                <TrashIcon width="14" height="14" />
                              </button>
                            </div>
                          </>
                        ) : (
                          <>
                          <div className="row" style={{ marginBottom: 10 }}>
                            <div className="title">
                              {currentTab !== 'all' && currentTab !== 'fav' ? (
                                <button
                                  className="icon-button fav-button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    removeFundFromCurrentGroup(f.code);
                                  }}
                                  title="从当前分组移除"
                                >
                                  <ExitIcon width="18" height="18" style={{ transform: 'rotate(180deg)' }} />
                                </button>
                              ) : (
                                <button
                                  className={`icon-button fav-button ${favorites.has(f.code) ? 'active' : ''}`}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    toggleFavorite(f.code);
                                  }}
                                  title={favorites.has(f.code) ? "取消自选" : "添加自选"}
                                >
                                  <StarIcon width="18" height="18" filled={favorites.has(f.code)} />
                                </button>
                              )}
                              <div className="title-text">
                                <span>{f.name}</span>
                                <span className="muted">#{f.code}</span>
                              </div>
                            </div>

                            <div className="actions">
                              <div className="badge-v">
                                <span>估值时间</span>
                                <strong>{f.gztime || f.time || '-'}</strong>
                              </div>
                              <div className="row" style={{ gap: 4 }}>
                                <button
                                  className="icon-button danger"
                                  onClick={() => setDeleteFundConfirm({ code: f.code, name: f.name })}
                                  title="删除"
                                  style={{ width: '28px', height: '28px' }}
                                >
                                  <TrashIcon width="14" height="14" />
                                </button>
                              </div>
                            </div>
                          </div>

                          <div className="row" style={{ marginBottom: 12 }}>
                            <Stat label="昨日净值" value={f.dwjz ?? '—'} />
                            <Stat label="估值净值" value={f.estPricedCoverage > 0.05 ? f.estGsz.toFixed(4) : (f.gsz ?? '—')} />
                            <Stat
                              label="估值涨跌幅"
                              value={f.estPricedCoverage > 0.05 ? `${f.estGszzl > 0 ? '+' : ''}${f.estGszzl.toFixed(2)}%` : (typeof f.gszzl === 'number' ? `${f.gszzl > 0 ? '+' : ''}${f.gszzl.toFixed(2)}%` : f.gszzl ?? '—')}
                              delta={f.estPricedCoverage > 0.05 ? f.estGszzl : (Number(f.gszzl) || 0)}
                            />
                          </div>
                          {(() => {
                            const pos = positions[f.code];
                            const currentPrice =
                              f.estPricedCoverage > 0.05
                                ? Number(f.estGsz)
                                : Number.isFinite(Number(f.gsz))
                                ? Number(f.gsz)
                                : Number(f.dwjz);
                            const hasPos = pos && pos.shares > 0;
                            const value =
                              hasPos && Number.isFinite(currentPrice) && currentPrice > 0
                                ? (pos.shares * currentPrice).toFixed(2)
                                : null;
                            const holdYield =
                              hasPos && pos.costPrice > 0 && Number.isFinite(currentPrice) && currentPrice > 0
                                ? ((currentPrice / pos.costPrice - 1) * 100).toFixed(2)
                                : null;
                            const recentYield =
                              hasPos && pos.lastTradeNav > 0 && Number.isFinite(currentPrice) && currentPrice > 0
                                ? ((currentPrice / pos.lastTradeNav - 1) * 100).toFixed(2)
                                : null;
                            return (
                              <div
                                className="row"
                                style={{
                                  marginBottom: 10,
                                  marginTop: -4,
                                  display: 'flex',
                                  flexWrap: 'wrap',
                                  gap: 8,
                                }}
                              >
                                <div className="badge-v">
                                  <span>金额</span>
                                  <strong>{hasPos && value ? `${value}` : '—'}</strong>
                                </div>
                                <div className="badge-v">
                                  <span>当前持有份额</span>
                                  <strong>
                                    {hasPos && pos.shares ? pos.shares.toFixed(2) : '—'}
                                  </strong>
                                </div>
                                <div className="badge-v">
                                  <span>成本价</span>
                                  <strong>{hasPos && pos.costPrice ? pos.costPrice.toFixed(4) : '—'}</strong>
                                </div>
                                <div className="badge-v">
                                  <span>持有收益率</span>
                                  <strong
                                    className={
                                      holdYield
                                        ? parseFloat(holdYield) > 0
                                          ? 'up'
                                          : parseFloat(holdYield) < 0
                                          ? 'down'
                                          : ''
                                        : ''
                                    }
                                  >
                                    {holdYield ? `${parseFloat(holdYield) > 0 ? '+' : ''}${holdYield}%` : '—'}
                                  </strong>
                                </div>
                                <div className="badge-v">
                                  <span>最近交易日</span>
                                  <strong>{hasPos && pos.lastTradeDate ? pos.lastTradeDate : '—'}</strong>
                                </div>
                                <div className="badge-v">
                                  <span>最近交易日收益</span>
                                  <strong
                                    className={
                                      recentYield
                                        ? parseFloat(recentYield) > 0
                                          ? 'up'
                                          : parseFloat(recentYield) < 0
                                          ? 'down'
                                          : ''
                                        : ''
                                    }
                                  >
                                    {recentYield
                                      ? `${parseFloat(recentYield) > 0 ? '+' : ''}${recentYield}%`
                                      : '—'}
                                  </strong>
                                </div>
                                <button
                                  className="button secondary"
                                  style={{ height: '28px', padding: '0 10px', fontSize: '12px' }}
                                  onClick={() => setEditingPositionFund(f)}
                                >
                                  编辑持仓
                                </button>
                              </div>
                            );
                          })()}
                          {f.estPricedCoverage > 0.05 && (
                            <div style={{ fontSize: '10px', color: 'var(--muted)', marginTop: -8, marginBottom: 10, textAlign: 'right' }}>
                              基于 {Math.round(f.estPricedCoverage * 100)}% 持仓估算
                            </div>
                          )}
                          <div
                            style={{ marginBottom: 8, cursor: 'pointer', userSelect: 'none' }}
                            className="title"
                            onClick={() => toggleCollapse(f.code)}
                          >
                            <div className="row" style={{ width: '100%', flex: 1 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <span>前10重仓股票</span>
                                <ChevronIcon
                                  width="16"
                                  height="16"
                                  className="muted"
                                  style={{
                                    transform: collapsedCodes.has(f.code) ? 'rotate(-90deg)' : 'rotate(0deg)',
                                    transition: 'transform 0.2s ease'
                                  }}
                                />
                              </div>
                              <span className="muted">涨跌幅 / 占比</span>
                            </div>
                          </div>
                          <AnimatePresence>
                            {!collapsedCodes.has(f.code) && (
                              <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: 'auto', opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                transition={{ duration: 0.3, ease: 'easeInOut' }}
                                style={{ overflow: 'hidden' }}
                              >
                                {Array.isArray(f.holdings) && f.holdings.length ? (
                                  <div className="list">
                                    {f.holdings.map((h, idx) => (
                                      <div className="item" key={idx}>
                                        <span className="name">{h.name}</span>
                                        <div className="values">
                                          {typeof h.change === 'number' && (
                                            <span className={`badge ${h.change > 0 ? 'up' : h.change < 0 ? 'down' : ''}`} style={{ marginRight: 8 }}>
                                              {h.change > 0 ? '+' : ''}{h.change.toFixed(2)}%
                                            </span>
                                          )}
                                          <span className="weight">{h.weight}</span>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                ) : (
                                  <div className="muted" style={{ padding: '8px 0' }}>暂无重仓数据</div>
                                )}
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </>
                      )}
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
                </div>
              </motion.div>
            </AnimatePresence>
          </>
          )}
        </div>
      </div>

      <div className="footer">
        <p>数据源：实时估值与重仓直连东方财富，仅供个人学习及参考使用。数据可能存在延迟，不作为任何投资建议
        </p>
        <p>注：估算数据与真实结算数据会有1%左右误差，非股票型基金误差较大</p>
        <div style={{ marginTop: 12, opacity: 0.8 }}>
          <p>
            遇到任何问题或需求建议可
            <button
              className="link-button"
              onClick={() => {
                setFeedbackNonce((n) => n + 1);
                setFeedbackOpen(true);
              }}
              style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', padding: '0 4px', textDecoration: 'underline', fontSize: 'inherit', fontWeight: 600 }}
            >
              点此提交反馈
            </button>
          </p>
        </div>
      </div>

      <AnimatePresence>
        {feedbackOpen && (
          <FeedbackModal
            key={feedbackNonce}
            onClose={() => setFeedbackOpen(false)}
          />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {addResultOpen && (
          <AddResultModal
            failures={addFailures}
            onClose={() => setAddResultOpen(false)}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {addFundToGroupOpen && (
          <AddFundToGroupModal
            allFunds={funds}
            currentGroupCodes={groups.find(g => g.id === currentTab)?.codes || []}
            onClose={() => setAddFundToGroupOpen(false)}
            onAdd={handleAddFundsToGroup}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {groupManageOpen && (
          <GroupManageModal
            groups={groups}
            onClose={() => setGroupManageOpen(false)}
            onSave={handleUpdateGroups}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {groupModalOpen && (
          <GroupModal
            onClose={() => setGroupModalOpen(false)}
            onConfirm={handleAddGroup}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {successModal.open && (
          <SuccessModal
            message={successModal.message}
            onClose={() => setSuccessModal({ open: false, message: '' })}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {deleteFundConfirm && (
          <ConfirmModal
            title="删除基金"
            message={`确定要删除基金「${deleteFundConfirm.name || ''} #${deleteFundConfirm.code}」吗？该基金的持仓与分组记录也会被移除。`}
            onConfirm={() => {
              removeFund(deleteFundConfirm.code);
              setDeleteFundConfirm(null);
            }}
            onCancel={() => setDeleteFundConfirm(null)}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {editingPositionFund && (
          <PositionModal
            fund={editingPositionFund}
            position={positions[editingPositionFund.code]}
            onClose={() => setEditingPositionFund(null)}
            onSave={(code, pos) => {
              setPositions(prev => {
                const next = { ...prev };
                if (!pos) {
                  delete next[code];
                } else {
                  next[code] = pos;
                }
                localStorage.setItem('positions', JSON.stringify(next));
                return next;
              });
            }}
          />
        )}
      </AnimatePresence>

      {settingsOpen && (
        <SettingsModal
          tempSeconds={tempSeconds}
          onTempSecondsChange={setTempSeconds}
          importFileRef={importFileRef}
          importMsg={importMsg}
          onExport={exportLocalData}
          onImportChange={handleImportFileChange}
          onSave={saveSettings}
          onClose={() => setSettingsOpen(false)}
        />
      )}
    </div>
  );
}
