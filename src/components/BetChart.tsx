'use client'

import { Card, CardContent } from "@/components/ui/card"
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer } from 'recharts'
import { 
  ChartContainer,
  ChartTooltip,
  ChartLegend,
  ChartLegendContent,
  type ChartConfig 
} from "@/components/ui/chart"
import { useMemo, useEffect, useState } from 'react'
import { useTranslation } from "react-i18next";

interface TimeSlot {
  time: string;
  multiplierHistory?: Array<{ bets: number; multiplier: number }>;
}

interface ChartDataPoint {
  bets: number;
  [key: string]: number;
}

interface BetChartProps {
  timeSlots: TimeSlot[] 
  selectedTime?: string
  hoveredTime?: string
  chartData: ChartDataPoint[] 
  chartConfig: ChartConfig
  gameStatus?: 'active' | 'pending_decision' | 'decided'
}

export function BetChart({
  timeSlots,
  selectedTime,
  hoveredTime,
  chartData,
  chartConfig,
  gameStatus = 'active'
}: BetChartProps) {
  // Add state to track if we're on mobile
  const [isMobile, setIsMobile] = useState(false);

  const { t } = useTranslation('BetChart');

  // Check if we're on mobile when component mounts and when window resizes
  useEffect(() => {
    const checkIfMobile = () => {
      setIsMobile(window.innerWidth < 768); // 768px is standard md breakpoint
    };
    
    // Check initially
    checkIfMobile();
    
    // Add resize listener
    window.addEventListener('resize', checkIfMobile);
    
    // Clean up
    return () => window.removeEventListener('resize', checkIfMobile);
  }, []);

  // Use useMemo to efficiently process the chart data only when needed
  const processedChartData = useMemo(() => {
    if (!chartData || chartData.length === 0) {
      return [];
    }
    
    return chartData.map(point => {
      const newPoint = { ...point };
      // Transform all values to percentages and round to integers
      Object.keys(point).forEach(key => {
        if (key !== 'bets') {
          newPoint[key] = Math.round(point[key] * 100);
        }
      });
      return newPoint;
    });
  }, [chartData]); // Only depend on chartData

  // Calculate dynamic Y-axis domain based on data values
  const yAxisDomain = useMemo(() => {
    if (!processedChartData || processedChartData.length === 0) {
      return [0, 100];
    }

    let minValue = Infinity;
    let maxValue = -Infinity;

    processedChartData.forEach(point => {
      Object.keys(point).forEach(key => {
        if (key !== 'bets' && typeof point[key] === 'number') {
          minValue = Math.min(minValue, point[key]);
          maxValue = Math.max(maxValue, point[key]);
        }
      });
    });

    // If no valid data points found, use default range
    if (minValue === Infinity || maxValue === -Infinity) {
      return [0, 100];
    }

    // Add padding (5% of the range) for better visualization
    const range = maxValue - minValue;
    const padding = Math.max(range * 0.05, 2); // At least 2% padding
    
    const paddedMin = Math.max(0, minValue - padding);
    const paddedMax = Math.min(100, maxValue + padding);
    
    return [paddedMin, paddedMax];
  }, [processedChartData]);
  
  // Don't render on mobile
  if (isMobile) {
    return null;
  }
  
  return (
    <div className="lg:col-span-2">
      <Card className="p-1 sm:p-4">
        <CardContent className="p-0">
          <h4 className="text-2xl font-medium mb-4 px-2 text-center">{t('Répartition des mises')}</h4>
          <div className="h-[250px] sm:h-[400px] md:h-[500px] w-full overflow-hidden relative">
            {timeSlots.every(slot => !slot.multiplierHistory || slot.multiplierHistory.length <= 1) ? (
              // Enhanced single point view
              <div className="flex flex-col items-center justify-center h-full space-y-4">
                <p className="text-muted-foreground text-lg">{t('Aucun pari placé pour le moment')}</p>
                {timeSlots
                  .filter(slot => slot.multiplierHistory && slot.multiplierHistory.length === 1)
                  .slice(0, 1)
                  .map((slot) => (
                    <div
                      key={slot.time}
                      className="flex flex-col items-center p-6 rounded-xl border bg-card/50"
                    >
                      <span className="text-sm text-muted-foreground mb-2">
                        {t('Probabilité initiale')}
                      </span>
                      <span className="text-5xl font-bold bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
                        {(1 / slot.multiplierHistory![0].multiplier * 100).toFixed(1)}%
                      </span>
                      <span className="text-sm text-muted-foreground mt-2">
                        {t('(Bonus pour le premier parieur)')}
                      </span>
                    </div>
                  ))}
                <p className="text-sm text-muted-foreground mt-2 max-w-md text-center">
                  {t('Les probabilités seront mises à jour automatiquement dès qu\'un pari sera placé')}
                </p>
              </div>
            ) : (
              <>
                <ResponsiveContainer width="100%" aspect={1}>
                  <ChartContainer config={chartConfig} className="w-full h-full">
                    <LineChart 
                      data={processedChartData} 
                      margin={{ top: 0, right: 0, bottom: 0, left: 10 }}
                    >
                      <XAxis 
                        dataKey="bets" 
                        tickLine={false}
                        axisLine={false}
                        tickMargin={10}
                        type="number"
                        domain={['dataMin', 'dataMax']}
                      />
                      <YAxis 
                        domain={yAxisDomain}
                        scale="linear"
                        tickCount={8}
                        tickLine={false}
                        axisLine={false}
                        tickMargin={5}
                        width={35}
                        tickFormatter={(value) => `${value.toFixed(0)}%`}
                      />
                      <ChartTooltip 
                        content={props => {
                          if (!props.active || !props.payload?.length) return null;
                          
                          // Sort the entire payload by value (highest percentages first)
                          const sortedPayload = [...props.payload]
                            .filter(item => item && item.dataKey !== 'bets')
                            .sort((a, b) => {
                              const aVal = typeof a.value === 'number' ? a.value : 0;
                              const bVal = typeof b.value === 'number' ? b.value : 0;
                              return bVal - aVal;
                            });
                          
                          // Find max value for the bar width calculation
                          const maxValue = sortedPayload.length > 0 && 
                            typeof sortedPayload[0].value === 'number' ? 
                            sortedPayload[0].value : 100;
                          
                          return (
                            <div className="rounded-lg border border-border/50 bg-background px-3 py-2 text-xs shadow-xl min-w-[250px]">
                              <div className="font-medium mb-1.5">
                                {props.label 
                                  ? (typeof props.labelFormatter === 'function' 
                                      ? props.labelFormatter(props.label, props.payload) 
                                      : `${props.label} ${t('paris')}`)
                                  : `${props.label} ${t('paris')}`
                                }
                              </div>
                              <div className="grid gap-1.5">
                                {sortedPayload.map(entry => {
                                  const value = typeof entry.value === 'number' ? entry.value : 0;
                                  const barWidth = Math.max(10, (value / maxValue) * 100);
                                  
                                  return (
                                    <div key={entry.dataKey} className="flex items-center gap-2 py-0.5 w-full">
                                      <div className="flex items-center gap-2 min-w-[80px]">
                                        <div 
                                          className="h-3 w-3 rounded-full" 
                                          style={{ backgroundColor: entry.dataKey && chartConfig[entry.dataKey]?.color || undefined }}
                                        />
                                        <span 
                                          className="font-medium" 
                                          style={{ color: entry.dataKey && chartConfig[entry.dataKey]?.color || undefined }}
                                        >
                                          {entry.dataKey || ''}
                                        </span>
                                      </div>
                                      <div className="flex-1 flex items-center gap-2">
                                        <div className="h-2 bg-muted rounded-full w-full">
                                          <div 
                                            className="h-2 rounded-full" 
                                            style={{ 
                                              width: `${barWidth}%`, 
                                              backgroundColor: entry.dataKey && chartConfig[entry.dataKey]?.color || undefined 
                                            }}
                                          />
                                        </div>
                                        <span className="font-mono font-medium tabular-nums text-foreground whitespace-nowrap">
                                          {value.toLocaleString()}%
                                        </span>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        }}
                      />
                      <ChartLegend 
                        content={<ChartLegendContent />}
                        verticalAlign="top"
                        align="center"
                      />
                      {timeSlots
                        .filter(slot => slot.multiplierHistory)
                        .map((slot) => (
                          <Line
                            key={slot.time}
                            type="monotone"
                            dataKey={slot.time}
                            stroke={chartConfig[slot.time]?.color}
                            strokeWidth={selectedTime === slot.time || hoveredTime === slot.time ? 4 : 2.5}
                            dot={selectedTime === slot.time || hoveredTime === slot.time ? {
                              stroke: chartConfig[slot.time]?.color,
                              strokeWidth: 2,
                              fill: 'white',
                              r: 5
                            } : false}
                            yAxisId={0}
                            name={slot.time}
                          />
                        ))}
                    </LineChart>
                  </ChartContainer>
                </ResponsiveContainer>
                {gameStatus !== 'active' && (
                  <div className="absolute inset-0 flex items-start justify-center pointer-events-none" style={{ top: '25%' }}>
                    <div className="transform">
                      <span className="text-4xl font-bold text-slate-400/50">
                        {gameStatus === 'pending_decision' ? t('En attente de décision') : t('Pari terminé')}
                      </span>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}