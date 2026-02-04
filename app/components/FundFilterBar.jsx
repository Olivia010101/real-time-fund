'use client';

import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { PlusIcon, SortIcon, GridIcon, ListIcon } from './Icons';

export default function FundFilterBar({
  fundsCount,
  favoritesCount,
  groups,
  currentTab,
  onChangeTab,
  viewMode,
  onChangeViewMode,
  sortBy,
  onChangeSortBy,
  onOpenGroupManage,
  onOpenGroupModal,
}) {
  const tabsRef = useRef(null);
  const [isDragging, setIsDragging] = useState(false);
  const [canLeft, setCanLeft] = useState(false);
  const [canRight, setCanRight] = useState(false);

  // 自动滚动选中 Tab 到可视区域
  useEffect(() => {
    if (!tabsRef.current) return;
    if (currentTab === 'all') {
      tabsRef.current.scrollTo({ left: 0, behavior: 'smooth' });
      return;
    }
    const activeTab = tabsRef.current.querySelector('.tab.active');
    if (activeTab) {
      activeTab.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
    }
  }, [currentTab]);

  const updateTabOverflow = () => {
    if (!tabsRef.current) return;
    const el = tabsRef.current;
    setCanLeft(el.scrollLeft > 0);
    setCanRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 1);
  };

  useEffect(() => {
    updateTabOverflow();
    const onResize = () => updateTabOverflow();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [groups, fundsCount, favoritesCount]);

  const handleMouseDown = () => {
    if (!tabsRef.current) return;
    setIsDragging(true);
  };

  const handleMouseLeaveOrUp = () => {
    setIsDragging(false);
  };

  const handleMouseMove = (e) => {
    if (!isDragging || !tabsRef.current) return;
    e.preventDefault();
    tabsRef.current.scrollLeft -= e.movementX;
  };

  const handleWheel = (e) => {
    if (!tabsRef.current) return;
    const delta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
    tabsRef.current.scrollLeft += delta;
  };

  return (
    <div
      className="filter-bar"
      style={{
        marginBottom: 16,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: 12,
      }}
    >
      <div className="tabs-container">
        <div
          className="tabs-scroll-area"
          data-mask-left={canLeft}
          data-mask-right={canRight}
        >
          <div
            className="tabs"
            ref={tabsRef}
            onMouseDown={handleMouseDown}
            onMouseLeave={handleMouseLeaveOrUp}
            onMouseUp={handleMouseLeaveOrUp}
            onMouseMove={handleMouseMove}
            onWheel={handleWheel}
            onScroll={updateTabOverflow}
          >
            <AnimatePresence mode="popLayout">
              <motion.button
                layout
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                key="all"
                className={`tab ${currentTab === 'all' ? 'active' : ''}`}
                onClick={() => onChangeTab('all')}
                transition={{ type: 'spring', stiffness: 500, damping: 30, mass: 1 }}
              >
                全部 ({fundsCount})
              </motion.button>
              <motion.button
                layout
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                key="fav"
                className={`tab ${currentTab === 'fav' ? 'active' : ''}`}
                onClick={() => onChangeTab('fav')}
                transition={{ type: 'spring', stiffness: 500, damping: 30, mass: 1 }}
              >
                自选 ({favoritesCount})
              </motion.button>
              {groups.map((g) => (
                <motion.button
                  layout
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  key={g.id}
                  className={`tab ${currentTab === g.id ? 'active' : ''}`}
                  onClick={() => onChangeTab(g.id)}
                  transition={{ type: 'spring', stiffness: 500, damping: 30, mass: 1 }}
                >
                  {g.name} ({g.codes.length})
                </motion.button>
              ))}
            </AnimatePresence>
          </div>
        </div>
        {groups.length > 0 && (
          <button
            className="icon-button manage-groups-btn"
            onClick={onOpenGroupManage}
            title="管理分组"
          >
            <SortIcon width="16" height="16" />
          </button>
        )}
        <button
          className="icon-button add-group-btn"
          onClick={onOpenGroupModal}
          title="新增分组"
        >
          <PlusIcon width="16" height="16" />
        </button>
      </div>

      <div
        className="sort-group"
        style={{ display: 'flex', alignItems: 'center', gap: 12 }}
      >
        <div
          className="view-toggle"
          style={{
            display: 'flex',
            background: 'rgba(255,255,255,0.05)',
            borderRadius: '10px',
            padding: '2px',
          }}
        >
          <button
            className={`icon-button ${viewMode === 'card' ? 'active' : ''}`}
            onClick={() => onChangeViewMode('card')}
            style={{
              border: 'none',
              width: '32px',
              height: '32px',
              background: viewMode === 'card' ? 'var(--primary)' : 'transparent',
              color: viewMode === 'card' ? '#05263b' : 'var(--muted)',
            }}
            title="卡片视图"
          >
            <GridIcon width="16" height="16" />
          </button>
          <button
            className={`icon-button ${viewMode === 'list' ? 'active' : ''}`}
            onClick={() => onChangeViewMode('list')}
            style={{
              border: 'none',
              width: '32px',
              height: '32px',
              background: viewMode === 'list' ? 'var(--primary)' : 'transparent',
              color: viewMode === 'list' ? '#05263b' : 'var(--muted)',
            }}
            title="表格视图"
          >
            <ListIcon width="16" height="16" />
          </button>
        </div>

        <div
          className="divider"
          style={{ width: '1px', height: '20px', background: 'var(--border)' }}
        />

        <div
          className="sort-items"
          style={{ display: 'flex', alignItems: 'center', gap: 8 }}
        >
          <span
            className="muted"
            style={{ fontSize: '12px', display: 'flex', alignItems: 'center', gap: 4 }}
          >
            <SortIcon width="14" height="14" />
            排序
          </span>
          <div className="chips">
            {[
              { id: 'default', label: '默认' },
              { id: 'yield', label: '涨跌幅' },
              { id: 'recentYield', label: '最近交易日收益' },
              { id: 'name', label: '名称' },
              { id: 'code', label: '代码' },
            ].map((s) => (
              <button
                key={s.id}
                className={`chip ${sortBy === s.id ? 'active' : ''}`}
                onClick={() => onChangeSortBy(s.id)}
                style={{ height: '28px', fontSize: '12px', padding: '0 10px' }}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}


