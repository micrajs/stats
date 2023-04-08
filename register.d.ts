declare global {
  namespace Micra {
    type StatsMetricType = 'c' | 'g' | 'ms' | 's' | 'h';

    interface StatsMetricOptions {
      max?: number;
      flushInterval?: number;
      keepMetrics?: boolean;
      autoStartFlushing?: boolean;
    }

    interface StatsOptions {
      prefix?: string | string[];
      sampleRate?: number;
      tags?: Record<string, string>;
      extras?: Record<string, any>;
      metrics?: StatsMetricOptions;
    }

    interface StatsScopeOptions {
      prefix: string | string[];
      sampleRate?: number;
      tags?: Record<string, string>;
      extras?: Record<string, any>;
    }

    interface StatsMetric {
      id: string;
      value: number;
      type: StatsMetricType;
      name: string;
      sampleRate?: number;
      extras?: Record<string, any>;
      tags?: Record<string, string>;
      toString(): string;
    }

    interface MetricOptions {
      name: string[] | string;
      value: number;
      type: StatsMetricType;
      sampleRate?: number;
      tags?: Record<string, string>;
      extras?: Record<string, any>;
    }

    interface CustomStatsMetricOptions {
      sampleRate?: number;
      tags?: Record<string, string>;
      extras?: Record<string, any>;
    }

    type StatsConsumer = (metric: StatsMetric) => void;

    interface Stats {
      options: StatsOptions;
      prefix: string;
      count(
        name: string,
        value: number,
        options?: CustomStatsMetricOptions,
      ): this;
      increment(
        name: string,
        value: number,
        options?: CustomStatsMetricOptions,
      ): this;
      decrement(
        name: string,
        value: number,
        options?: CustomStatsMetricOptions,
      ): this;
      gauge(
        name: string,
        value: number,
        options?: CustomStatsMetricOptions,
      ): this;
      timing(
        name: string,
        value: number,
        options?: CustomStatsMetricOptions,
      ): this;
      startTimer(name: string, options?: CustomStatsMetricOptions): () => void;
      set(
        name: string,
        value: number,
        options?: CustomStatsMetricOptions,
      ): this;
      histogram(
        name: string,
        value: number,
        options?: CustomStatsMetricOptions,
      ): this;
      setTags(tags: Record<string, string>): this;
      hasTags(): boolean;
      addConsumer(consumer: StatsConsumer): () => void;
      removeConsumer(consumer: StatsConsumer): this;
      flush(): this;
      send(metric: StatsMetric): this;
      createScope(options: StatsOptions): Stats;
      startFlushInterval(): this;
      stopFlushInterval(): this;
    }
  }
}

export {};
