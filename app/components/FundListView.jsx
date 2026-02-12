'use client';

import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Stat from "./Stat";
import FundTrendChart from "./FundTrendChart";
import IntradayTrendChart from "./IntradayTrendChart";
import TimeRangeSelector from "./TimeRangeSelector";
import { 
  ChevronIcon, 
  ExitIcon, 
  FolderPlusIcon, 
  StarIcon, 
  TrashIcon,
} from "./Icons";

// 时间范围到毫秒数的映射
const TIME_RANGES = {
  '1M': 30 * 24 * 60 * 60 * 1000,      // 1个月
  '3M': 90 * 24 * 60 * 60 * 1000,      // 3个月
  '1Y': 365 * 24 * 60 * 60 * 1000,     // 1年
  '5Y': 5 * 365 * 24 * 60 * 60 * 1000, // 5年
};

/**
 * 根据时间范围过滤历史数据
 * @param {Array} data - 历史净值数据 [{x: timestamp, y: number}, ...]
 * @param {string} range - 时间范围 ('1M', '3M', '1Y', '5Y', 'ALL')
 * @returns {Array} 过滤后的数据
 */
const filterHistoryByRange = (data, range) => {
  if (!data || data.length === 0) return [];
  if (range === 'ALL') return data;
  
  const now = Date.now();
  const cutoff = now - (TIME_RANGES[range] || 0);
  
  return data.filter(d => d.x >= cutoff);
};

/**
 * 基金列表展示组件（卡片视图 + 列表视图）
 * 纯展示 + 回调，不持有业务状态。
 */
export default function FundListView({
  funds,
  viewMode,
  currentTab,
  favorites,
  positions,
  collapsedCodes,
  intradayData,
  onToggleFavorite,
  onRemoveFromCurrentGroup,
  onEditPosition,
  onDeleteFund,
  onToggleCollapse,
}) {
  // 为每个基金维护时间范围状态
  const [timeRanges, setTimeRanges] = useState({});

  // 获取基金的时间范围（默认1M）
  const getTimeRange = (code) => timeRanges[code] || '1M';
  
  // 设置基金的时间范围
  const setTimeRange = (code, range) => {
    setTimeRanges(prev => ({
      ...prev,
      [code]: range,
    }));
  };

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={viewMode}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        transition={{ duration: 0.2 }}
        className={viewMode === 'card' ? 'grid' : 'table-container glass'}
      >
        <div
          className={viewMode === 'card' ? 'grid col-12' : ''}
          style={viewMode === 'card' ? { gridColumn: 'span 12', gap: 16 } : {}}
        >
          <AnimatePresence mode="popLayout">
            {funds.map((f) => (
              <FundCard
                key={f.code}
                fund={f}
                viewMode={viewMode}
                currentTab={currentTab}
                favorites={favorites}
                positions={positions}
                collapsedCodes={collapsedCodes}
                intradayData={intradayData}
                timeRange={getTimeRange(f.code)}
                onTimeRangeChange={(range) => setTimeRange(f.code, range)}
                onToggleFavorite={onToggleFavorite}
                onRemoveFromCurrentGroup={onRemoveFromCurrentGroup}
                onEditPosition={onEditPosition}
                onDeleteFund={onDeleteFund}
                onToggleCollapse={onToggleCollapse}
              />
            ))}
          </AnimatePresence>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

/**
 * 单个基金卡片组件
 */
function FundCard({
  fund: f,
  viewMode,
  currentTab,
  favorites,
  positions,
  collapsedCodes,
  intradayData,
  timeRange,
  onTimeRangeChange,
  onToggleFavorite,
  onRemoveFromCurrentGroup,
  onEditPosition,
  onDeleteFund,
  onToggleCollapse,
}) {
  // 判断是否有日内数据
  const hasIntradayData = intradayData[f.code] && intradayData[f.code].length > 0;
  
  // 如果当前选中1日但没有日内数据，自动切换到1M
  const effectiveTimeRange = timeRange === '1D' && !hasIntradayData ? '1M' : timeRange;
  
  // 计算要显示的数据
  const displayData = useMemo(() => {
    if (effectiveTimeRange === '1D') {
      return { type: 'intraday', data: intradayData[f.code] || [] };
    }
    return { 
      type: 'history', 
      data: filterHistoryByRange(f.historyTrend, effectiveTimeRange),
    };
  }, [f.code, f.historyTrend, intradayData, effectiveTimeRange]);

  return (
    <motion.div
      layout="position"
      className={viewMode === 'card' ? 'col-6' : 'table-row-wrapper'}
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.2 }}
    >
      <div className={viewMode === 'card' ? 'glass card' : 'table-row'}>
        {viewMode === 'list' ? (
          <ListView
            f={f}
            currentTab={currentTab}
            favorites={favorites}
            positions={positions}
            onToggleFavorite={onToggleFavorite}
            onRemoveFromCurrentGroup={onRemoveFromCurrentGroup}
            onDeleteFund={onDeleteFund}
          />
        ) : (
          <CardView
            f={f}
            currentTab={currentTab}
            favorites={favorites}
            positions={positions}
            collapsedCodes={collapsedCodes}
            hasIntradayData={hasIntradayData}
            timeRange={effectiveTimeRange}
            onTimeRangeChange={onTimeRangeChange}
            displayData={displayData}
            onToggleFavorite={onToggleFavorite}
            onRemoveFromCurrentGroup={onRemoveFromCurrentGroup}
            onEditPosition={onEditPosition}
            onDeleteFund={onDeleteFund}
            onToggleCollapse={onToggleCollapse}
          />
        )}
      </div>
    </motion.div>
  );
}

/**
 * 列表视图
 */
function ListView({ f, currentTab, favorites, positions, onToggleFavorite, onRemoveFromCurrentGroup, onDeleteFund }) {
  return (
    <>
      <div className="table-cell name-cell">
        {currentTab !== 'all' && currentTab !== 'fav' ? (
          <button
            className="icon-button fav-button"
            onClick={(e) => {
              e.stopPropagation();
              onRemoveFromCurrentGroup(f.code);
            }}
            title="从当前分组移除"
          >
            <ExitIcon
              width="18"
              height="18"
              style={{ transform: 'rotate(180deg)' }}
            />
          </button>
        ) : (
          <button
            className={`icon-button fav-button ${favorites.has(f.code) ? 'active' : ''}`}
            onClick={(e) => {
              e.stopPropagation();
              onToggleFavorite(f.code);
            }}
            title={favorites.has(f.code) ? '取消自选' : '添加自选'}
          >
            <StarIcon
              width="18"
              height="18"
              filled={favorites.has(f.code)}
            />
          </button>
        )}
        <div className="title-text">
          <span className="name-text">{f.name}</span>
          <span className="muted code-text">#{f.code}</span>
        </div>
      </div>
      <div className="table-cell text-right value-cell">
        <span style={{ fontWeight: 700 }}>
          {f.estPricedCoverage > 0.05
            ? f.estGsz.toFixed(4)
            : f.gsz ?? '—'}
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
            hasPos &&
            pos.costPrice > 0 &&
            Number.isFinite(currentPrice) &&
            currentPrice > 0
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
                <div
                  className="muted"
                  style={{ fontSize: '11px', marginTop: 2 }}
                >
                  暂无持仓
                </div>
              )}
            </div>
          );
        })()}
      </div>
      <div className="table-cell text-center action-cell" style={{ gap: 4 }}>
        <button
          className="icon-button danger"
          onClick={() => onDeleteFund(f.code, f.name)}
          title="删除"
          style={{ width: '28px', height: '28px' }}
        >
          <TrashIcon width="14" height="14" />
        </button>
      </div>
    </>
  );
}

/**
 * 卡片视图
 */
function CardView({
  f,
  currentTab,
  favorites,
  positions,
  collapsedCodes,
  hasIntradayData,
  timeRange,
  onTimeRangeChange,
  displayData,
  onToggleFavorite,
  onRemoveFromCurrentGroup,
  onEditPosition,
  onDeleteFund,
  onToggleCollapse,
}) {
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
    hasPos &&
    pos.costPrice > 0 &&
    Number.isFinite(currentPrice) &&
    currentPrice > 0
      ? ((currentPrice / pos.costPrice - 1) * 100).toFixed(2)
      : null;
  const recentYield =
    hasPos &&
    pos.lastTradeNav > 0 &&
    Number.isFinite(currentPrice) &&
    currentPrice > 0
      ? ((currentPrice / pos.lastTradeNav - 1) * 100).toFixed(2)
      : null;

  return (
    <>
      {/* 头部 */}
      <div className="row" style={{ marginBottom: 10 }}>
        <div className="title">
          {currentTab !== 'all' && currentTab !== 'fav' ? (
            <button
              className="icon-button fav-button"
              onClick={(e) => {
                e.stopPropagation();
                onRemoveFromCurrentGroup(f.code);
              }}
              title="从当前分组移除"
            >
              <ExitIcon
                width="18"
                height="18"
                style={{ transform: 'rotate(180deg)' }}
              />
            </button>
          ) : (
            <button
              className={`icon-button fav-button ${favorites.has(f.code) ? 'active' : ''}`}
              onClick={(e) => {
                e.stopPropagation();
                onToggleFavorite(f.code);
              }}
              title={favorites.has(f.code) ? '取消自选' : '添加自选'}
            >
              <StarIcon
                width="18"
                height="18"
                filled={favorites.has(f.code)}
              />
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
              onClick={() => onDeleteFund(f.code, f.name)}
              title="删除"
              style={{ width: '28px', height: '28px' }}
            >
              <TrashIcon width="14" height="14" />
            </button>
          </div>
        </div>
      </div>

      {/* 统计数据 */}
      <div className="row" style={{ marginBottom: 12 }}>
        {hasPos ? <Stat label="金额" value={value ?? '—'} /> : null}
        <Stat label="昨日净值" value={f.dwjz ?? '—'} />
        <Stat
          label="估值净值"
          value={
            f.estPricedCoverage > 0.05
              ? f.estGsz.toFixed(4)
              : f.gsz ?? '—'
          }
        />
        <Stat
          label="估值涨跌幅"
          value={
            f.estPricedCoverage > 0.05
              ? `${f.estGszzl > 0 ? '+' : ''}${f.estGszzl.toFixed(2)}%`
              : typeof f.gszzl === 'number'
                ? `${f.gszzl > 0 ? '+' : ''}${f.gszzl.toFixed(2)}%`
                : f.gszzl ?? '—'
          }
          delta={
            f.estPricedCoverage > 0.05 ? f.estGszzl : Number(f.gszzl) || 0
          }
        />
        <Stat
          label="昨日涨幅"
          value={
            typeof f.yesterdayChange === 'number'
              ? `${f.yesterdayChange > 0 ? '+' : ''}${f.yesterdayChange.toFixed(2)}%`
              : '—'
          }
          delta={
            Number.isFinite(Number(f.yesterdayChange)) ? f.yesterdayChange : 0
          }
        />
      </div>

      {/* 持仓信息 */}
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
          <span>当前持有份额</span>
          <strong>
            {hasPos && pos.shares ? pos.shares.toFixed(2) : '—'}
          </strong>
        </div>
        <div className="badge-v">
          <span>成本价</span>
          <strong>
            {hasPos && pos.costPrice ? pos.costPrice.toFixed(4) : '—'}
          </strong>
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
            {holdYield
              ? `${parseFloat(holdYield) > 0 ? '+' : ''}${holdYield}%`
              : '—'}
          </strong>
        </div>
        <div className="badge-v">
          <span>最近交易日</span>
          <strong>
            {hasPos && pos.lastTradeDate ? pos.lastTradeDate : '—'}
          </strong>
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
          onClick={() => onEditPosition(f)}
        >
          编辑持仓
        </button>
      </div>

      {/* 估算说明 */}
      {f.estPricedCoverage > 0.05 && (
        <div
          style={{
            fontSize: '10px',
            color: 'var(--muted)',
            marginTop: -8,
            marginBottom: 10,
            textAlign: 'right',
          }}
        >
          基于 {Math.round(f.estPricedCoverage * 100)}% 持仓估算
        </div>
      )}

      {/* 重仓股区域 */}
      <div
        style={{ marginBottom: 8, cursor: 'pointer', userSelect: 'none' }}
        className="title"
        onClick={() => onToggleCollapse(f.code)}
      >
        <div className="row" style={{ width: '100%', flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span>前10重仓股票</span>
            <ChevronIcon
              width="16"
              height="16"
              className="muted"
              style={{
                transform: collapsedCodes.has(f.code)
                  ? 'rotate(-90deg)'
                  : 'rotate(0deg)',
                transition: 'transform 0.2s ease',
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
                        <span
                          className={`badge ${h.change > 0 ? 'up' : h.change < 0 ? 'down' : ''}`}
                          style={{ marginRight: 8 }}
                        >
                          {h.change > 0 ? '+' : ''}
                          {h.change.toFixed(2)}%
                        </span>
                      )}
                      <span className="weight">{h.weight}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="muted" style={{ padding: '8px 0' }}>
                暂无重仓数据
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* 净值走势图区域 */}
      <div style={{ marginTop: 16, marginBottom: 4 }}>
        {/* 时间范围选择器 */}
        <div style={{ marginBottom: 8 }}>
          <TimeRangeSelector
            value={timeRange}
            onChange={onTimeRangeChange}
            hasIntraday={hasIntradayData}
          />
        </div>
        
        {/* 图表 */}
        {timeRange === '1D' ? (
          // 日内实时走势图
          <IntradayTrendChart
            data={displayData.data}
            lastDwjz={f.dwjz ? Number(f.dwjz) : null}
          />
        ) : (
          // 历史净值走势图
          <FundTrendChart
            data={displayData.data}
            timeRange={timeRange}
          />
        )}
      </div>
    </>
  );
}
