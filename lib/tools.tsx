import { tool } from 'ai';
import { z } from 'zod';
import { ElasticsearchResponse } from './elasticsearch/helper';

const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export const reduceChartData = (elasticsearchResponse: ElasticsearchResponse) => {
  const hits = elasticsearchResponse.hits['hits'];
  if (hits.length === 0) {
    return [];
  }

  const minimalChartData = hits
    .sort((a, b) => new Date(a._source['@timestamp']).getTime() - new Date(b._source['@timestamp']).getTime())
    .map((hit) => {
      const _source = hit['_source'];
      const timestamp = new Date(_source['@timestamp']);
      const year = timestamp.getFullYear();
      const month = timestamp.getMonth();

      return {
        month: `${monthNames[month]} ${year}`, // FIXME: this is just a temporary solution to differentiate between months
        log_level: _source.log_level,
        timestamp: _source['@timestamp'],
      };
    });

  const reducedChartData = minimalChartData.reduce<
    Array<{
      month: string;
      INFO: number;
      WARN: number;
      DEBUG: number;
      ERROR: number;
    }>
  >((acc, curr) => {
    const existingIndex = acc.findIndex((item) => item.month === curr.month);

    if (existingIndex === -1) {
      acc.push({
        month: curr.month,
        INFO: curr.log_level === 'INFO' ? 1 : 0,
        WARN: curr.log_level === 'WARN' ? 1 : 0,
        DEBUG: curr.log_level === 'DEBUG' ? 1 : 0,
        ERROR: curr.log_level === 'ERROR' ? 1 : 0,
      });
    } else {
      const existingMonthRecord = acc[existingIndex];
      acc[existingIndex] = {
        ...existingMonthRecord,
        [curr.log_level as keyof typeof existingMonthRecord]:
          existingMonthRecord[curr.log_level as keyof typeof existingMonthRecord] + 1,
      };
    }

    return acc;
  }, []);

  return reducedChartData;
};

const visualizeLogLevels = tool({
  description: 'Create a visualization of the log levels ',
  parameters: z.object({
    logData: z.any(), // FIXME: any type
  }),
  execute: async (props) => {
    const { logData } = props;

    return logData;
  },
});

export { visualizeLogLevels };
