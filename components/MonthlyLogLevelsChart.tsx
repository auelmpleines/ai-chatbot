'use client';
import { Bar, BarChart, CartesianGrid, XAxis } from 'recharts';
import { ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from './ui/chart';

const monthlyLogLevelChartConfig = {
  INFO: {
    label: 'INFO',
    color: '#2563eb',
  },

  WARN: {
    label: 'WARN',
    color: '#60a5fa',
  },

  DEBUG: {
    label: 'DEBUG',
    color: '#93c5fd',
  },
} satisfies ChartConfig;

export const MonthlyLogLevelChart = ({
  data,
}: {
  data: {
    month: string;
    INFO: number;
    WARN: number;
    DEBUG: number;
  }[];
}) => {
  return (
    <ChartContainer config={monthlyLogLevelChartConfig} className="min-h-[200px] w-full max-w-lg mx-auto">
      <BarChart accessibilityLayer data={data}>
        <CartesianGrid vertical={false} />
        <XAxis dataKey="month" tickLine={false} tickMargin={10} axisLine={false} />
        <ChartTooltip content={<ChartTooltipContent />} />
        <Bar key="INFO" dataKey="INFO" fill="blue" radius={4} />
        <Bar key="WARN" dataKey="WARN" fill="yellow" radius={4} />
        <Bar key="DEBUG" dataKey="DEBUG" fill="red" radius={4} />
      </BarChart>
    </ChartContainer>
  );
};
