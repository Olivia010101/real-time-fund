'use client';

/**
 * 时间窗口切换组件
 * @param {{ value: string, onChange: (value: string) => void, hasIntraday: boolean }} props
 */
export default function TimeRangeSelector({ value, onChange, hasIntraday = false }) {
  const ranges = [
    { key: '1D', label: '1日', tooltip: '今日实时估值' },
    { key: '1M', label: '1月', tooltip: '近1个月' },
    { key: '3M', label: '3月', tooltip: '近3个月' },
    { key: '1Y', label: '1年', tooltip: '近1年' },
    { key: '5Y', label: '5年', tooltip: '近5年' },
    { key: 'ALL', label: '成立来', tooltip: '成立以来' },
  ];

  return (
    <div className="time-range-selector">
      {ranges.map((range) => {
        const isActive = value === range.key;
        const isIntraday = range.key === '1D';
        
        // 1日按钮特殊样式：如果没有日内数据，显示为禁用状态
        const isDisabled = isIntraday && !hasIntraday;
        
        return (
          <button
            key={range.key}
            className={`time-range-btn ${isActive ? 'active' : ''} ${isDisabled ? 'disabled' : ''}`}
            onClick={() => !isDisabled && onChange(range.key)}
            title={range.tooltip}
            disabled={isDisabled}
          >
            {range.label}
          </button>
        );
      })}
    </div>
  );
}
