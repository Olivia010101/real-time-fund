'use client';

import { useEffect, useRef } from 'react';
import * as echarts from 'echarts/core';
import { LineChart } from 'echarts/charts';
import { TooltipComponent, GridComponent, MarkLineComponent } from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';

// 按需注册图表和组件
echarts.use([TooltipComponent, GridComponent, MarkLineComponent, LineChart, CanvasRenderer]);

/**
 * 日内实时估值走势图组件
 * @param {{ data: { time: string, value: number, change: number, timestamp: number }[], lastDwjz: number }} props
 */
export default function IntradayTrendChart({ data, lastDwjz }) {
  const chartRef = useRef(null);
  const instanceRef = useRef(null);

  useEffect(() => {
    if (!Array.isArray(data) || data.length < 2) return;
    if (!chartRef.current) return;

    let destroyed = false;

    if (instanceRef.current) {
      instanceRef.current.dispose();
      instanceRef.current = null;
    }

    const el = chartRef.current;
    const chart = echarts.init(el);
    instanceRef.current = chart;

    const values = data.map(d => d.value).filter(v => Number.isFinite(v));
    if (values.length < 2) return;

    const minValue = Math.min(...values);
    const maxValue = Math.max(...values);
    const valueRange = maxValue - minValue;
    
    // 使用昨日净值作为基准线
    const baseline = lastDwjz || (minValue + maxValue) / 2;
    
    // 计算涨跌幅决定颜色
    const lastPoint = data[data.length - 1];
    const firstPoint = data[0];
    const change = lastPoint.value - firstPoint.value;
    const isUp = change >= 0;
    
    const colorUp = '#ff4d4f';
    const colorDown = '#52c41a';
    const mainColor = isUp ? colorUp : colorDown;

    const option = {
      animation: false,
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'line' },
        formatter(params) {
          const p = params && params[0];
          if (!p) return '';
          const dataPoint = data[p.dataIndex];
          if (!dataPoint) return '';
          return `${dataPoint.time}<br/>估值：${dataPoint.value.toFixed(4)}<br/>涨跌：${dataPoint.change > 0 ? '+' : ''}${dataPoint.change.toFixed(2)}%`;
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
        type: 'category',
        boundaryGap: false,
        data: data.map(d => d.time),
        axisLine: { show: true, lineStyle: { color: '#e5e5e5', width: 1 } },
        axisTick: { show: false },
        axisLabel: {
          show: true,
          color: '#999',
          fontSize: 10,
          interval: Math.floor(data.length / 6), // 显示大约6个时间点
          formatter: (value) => value,
        },
        splitLine: { show: false },
      },
      yAxis: {
        type: 'value',
        min: baseline - Math.max(valueRange, baseline * 0.01) * 0.6,
        max: baseline + Math.max(valueRange, baseline * 0.01) * 0.6,
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
            opacity: 0.1,
            color: mainColor,
          },
          data: data.map(d => d.value),
          markLine: lastDwjz ? {
            silent: true,
            symbol: 'none',
            lineStyle: {
              color: '#999',
              type: 'dashed',
              width: 1,
            },
            data: [
              {
                yAxis: lastDwjz,
                label: {
                  show: true,
                  position: 'end',
                  formatter: '昨收',
                  color: '#999',
                  fontSize: 9,
                },
              },
            ],
          } : undefined,
        },
      ],
    };

    chart.setOption(option);
    chart.resize();

    return () => {
      destroyed = true;
      if (instanceRef.current) {
        instanceRef.current.dispose();
        instanceRef.current = null;
      }
    };
  }, [data, lastDwjz]);

  if (!Array.isArray(data) || data.length < 2) {
    return (
      <div
        className="intraday-trend-chart"
        style={{
          width: '100%',
          height: 100,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#999',
          fontSize: 12,
        }}
      >
        今日暂无估值数据
      </div>
    );
  }

  return (
    <div
      className="intraday-trend-chart"
      ref={chartRef}
      style={{
        width: '100%',
        height: 100,
      }}
    />
  );
}
