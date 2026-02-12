'use client';

import { useEffect, useRef, useMemo } from 'react';
import * as echarts from 'echarts/core';
import { LineChart } from 'echarts/charts';
import { TooltipComponent, GridComponent } from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';

// 按需注册图表和组件
echarts.use([TooltipComponent, GridComponent, LineChart, CanvasRenderer]);

/**
 * 根据时间范围获取x轴标签格式
 */
const getAxisLabelFormatter = (timeRange) => {
  return (value) => {
    const d = new Date(value);
    if (!Number.isFinite(d.getTime())) return '';
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    
    // 根据时间范围决定显示格式
    if (timeRange === '1M' || timeRange === '3M') {
      // 1月、3月显示 MM-DD
      return `${month}-${day}`;
    } else if (timeRange === '1Y') {
      // 1年显示月份
      return `${month}月`;
    } else if (timeRange === '5Y' || timeRange === 'ALL') {
      // 5年和成立以来显示年份
      return `${year}`;
    }
    // 默认显示 MM-DD
    return `${month}-${day}`;
  };
};

/**
 * 根据时间范围获取x轴时间间隔（毫秒）
 * 用于控制时间轴标签显示的最小间隔
 */
const getAxisMinInterval = (timeRange) => {
  const dayMs = 24 * 60 * 60 * 1000;
  
  if (timeRange === '1M') {
    return dayMs * 3; // 每3天显示一次
  } else if (timeRange === '3M') {
    return dayMs * 10; // 每10天显示一次
  } else if (timeRange === '1Y') {
    return dayMs * 30; // 每月显示一次（约30天）
  } else if (timeRange === '5Y') {
    return dayMs * 180; // 每半年显示一次
  } else if (timeRange === 'ALL') {
    return dayMs * 365; // 每年显示一次
  }
  
  return 'auto';
};

/**
 * 使用 ECharts 渲染的净值趋势图
 * @param {{ data: { x: number, y: number, equityReturn?: number }[], timeRange: string }} props
 */
export default function FundTrendChart({ data, timeRange = '1M' }) {
  const chartRef = useRef(null);
  const instanceRef = useRef(null);
  const dataRef = useRef(data);
  const timeRangeRef = useRef(timeRange);

  // 记忆化颜色计算
  const { isUp, isDown, minY, maxY } = useMemo(() => {
    const ys = data
      .map((d) => Number(d.y))
      .filter((v) => Number.isFinite(v));
    
    if (ys.length < 2) {
      return { isUp: false, isDown: false, minY: 0, maxY: 0 };
    }

    const min = Math.min(...ys);
    const max = Math.max(...ys);
    
    // 使用最后一个点的日涨跌幅决定颜色
    const lastPoint = data[data.length - 1] || {};
    const lastChange = Number(lastPoint.equityReturn);
    
    return {
      isUp: lastChange > 0,
      isDown: lastChange < 0,
      minY: min,
      maxY: max,
    };
  }, [data]);

  useEffect(() => {
    dataRef.current = data;
    timeRangeRef.current = timeRange;
    
    if (!Array.isArray(data) || data.length < 2) return;
    if (!chartRef.current) return;

    if (instanceRef.current) {
      instanceRef.current.dispose();
      instanceRef.current = null;
    }

    const el = chartRef.current;
    const chart = echarts.init(el);
    instanceRef.current = chart;

    const ys = data
      .map((d) => Number(d.y))
      .filter((v) => Number.isFinite(v));
    if (ys.length < 2) return;

    const colorUp = '#ff4d4f';
    const colorDown = '#52c41a';
    const colorFlat = '#999999';
    const mainColor = isUp ? colorUp : isDown ? colorDown : colorFlat;

    const option = {
      animation: false,
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'line' },
        formatter(params) {
          const p = params && params[0];
          if (!p) return '';
          const date = new Date(p.value[0]);
          const d = Number.isFinite(date.getTime()) &&
            `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
          return `${d || ''}<br/>净值：${p.value[1]}`;
        },
      },
      grid: {
        left: 0,
        right: 4,
        top: 8,
        bottom: 16,
        containLabel: true,
      },
      xAxis: {
        type: 'time',
        boundaryGap: false,
        axisLine: { show: true, lineStyle: { color: '#e5e5e5', width: 1 } },
        axisTick: { show: false },
        axisLabel: {
          show: true,
          color: '#999',
          fontSize: 10,
          formatter: getAxisLabelFormatter(timeRange),
          hideOverlap: true, // 自动隐藏重叠的标签
        },
        minInterval: getAxisMinInterval(timeRange), // 根据时间范围设置最小时间间隔
        splitLine: { show: false },
      },
      yAxis: {
        type: 'value',
        min: minY,
        max: maxY,
        axisLine: { show: true, lineStyle: { color: '#e5e5e5', width: 1 } },
        axisTick: { show: false },
        axisLabel: {
          show: true,
          color: '#999',
          fontSize: 10,
          formatter: (value) => value.toFixed(4),
        },
        splitLine: { show: false },
      },
      series: [
        {
          type: 'line',
          symbol: 'none',
          smooth: true,
          lineStyle: {
            width: 1.5,
            color: mainColor,
          },
          areaStyle: {
            opacity: 0.05,
            color: mainColor,
          },
          data: data.map((d) => [d.x, Number(d.y)]),
        },
      ],
    };

    chart.setOption(option);
    chart.resize();

    return () => {
      if (instanceRef.current) {
        instanceRef.current.dispose();
        instanceRef.current = null;
      }
    };
  }, [data, timeRange, isUp, isDown, minY, maxY]);

  if (!Array.isArray(data) || data.length < 2) {
    return (
      <div
        className="fund-trend-chart"
        style={{
          width: '100%',
          height: 120,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#999',
          fontSize: 12,
        }}
      >
        暂无历史数据
      </div>
    );
  }

  return (
    <div
      className="fund-trend-chart"
      ref={chartRef}
      style={{
        width: '100%',
        height: 120,
      }}
    />
  );
}
