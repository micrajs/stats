import {MersenneTwister19937} from '../utilities/marsenne-twister';
import {StatsMetric} from './StatsMetric';

export interface StatsListener {
  consumed: string[];
  listener: Micra.StatsConsumer;
}

export class Stats implements Micra.Stats {
  options: Micra.StatsOptions;
  _prefix: string[];
  _stats: Micra.StatsMetric[] = [];
  _metric: Micra.StatsMetricOptions;
  _tags: Record<string, string>;
  _sampleRate?: number;
  _interval?: NodeJS.Timeout;
  _isFlushing?: boolean = false;
  _consumers: Map<Micra.StatsConsumer, StatsListener> = new Map();
  _scopes: Set<Stats> = new Set();
  _extras?: Record<string, any>;
  _marsenne: MersenneTwister19937 = new MersenneTwister19937();

  get prefix(): string {
    return this._prefix.filter(Boolean).join('.');
  }

  get metrics(): Readonly<Micra.StatsMetric>[] {
    let metrics: Readonly<StatsMetric>[] = [];

    for (const scope of this._scopes) {
      metrics = metrics.concat(
        scope._stats.map(Object.freeze) as Readonly<StatsMetric>[],
      );
    }

    return metrics.sort(
      (a, b) => a.emittedAt.getTime() - b.emittedAt.getTime(),
    );
  }

  constructor(options: Micra.StatsOptions = {}) {
    this.options = options;
    this._tags = options.tags || {};
    this._sampleRate = options.sampleRate;
    this._extras = options.extras;
    this._metric = {
      max: Infinity,
      flushInterval: 1000,
      keepMetrics: false,
      autoStartFlushing: true,
      ...options.metrics,
    };
    this._prefix = options.prefix
      ? Array.isArray(options.prefix)
        ? options.prefix
        : [options.prefix]
      : [];
    this._scopes.add(this);

    if (this._metric.autoStartFlushing) {
      this.startFlushInterval();
    }
  }

  startFlushInterval(): this {
    if (this._metric.flushInterval && this._metric.flushInterval > 0) {
      this._interval = setInterval(
        () => this.flush(),
        this._metric.flushInterval,
      );
    }

    return this;
  }

  stopFlushInterval(): this {
    if (this._interval) {
      clearInterval(this._interval);
    }

    return this;
  }

  flush(): this {
    if (this._isFlushing) {
      return this;
    }

    this._isFlushing = true;
    for (const scope of this._scopes) {
      if (scope !== this) {
        scope.flush();
      }
      scope._stats.forEach((metric) => {
        this.send(metric);
        if (!scope._metric.keepMetrics) {
          scope._stats = scope._stats.filter((m) => m.id !== metric.id);
        }
      });
    }
    this._isFlushing = false;

    return this;
  }

  pushMetric(metric: Micra.StatsMetric): this {
    this._stats.push(metric);

    if (this._metric.max && this._stats.length > this._metric.max) {
      this._stats.shift();
    }

    if (this._metric.flushInterval === 0) {
      this.flush();
    }

    return this;
  }

  setTags(tags: Record<string, string>): this {
    this._tags = Object.assign(this._tags == null ? {} : this._tags, tags);

    return this;
  }

  hasTags(): boolean {
    return !!this._tags && Object.keys(this._tags).length > 0;
  }

  setName(...prefixes: (string | string[])[]) {
    for (const prefix of prefixes) {
      this._prefix = this._prefix.concat(prefix);
    }
    return this;
  }

  count(
    name: string,
    value: number,
    options: Micra.CustomStatsMetricOptions = {},
  ): this {
    const metric = new StatsMetric({
      name: [this.prefix, name],
      value,
      type: 'c',
      sampleRate: options.sampleRate || this._sampleRate,
      tags: Object.assign({}, this._tags ?? {}, options?.tags ?? {}),
      extras: Object.assign({}, this._extras ?? {}, options?.extras ?? {}),
    });

    this.pushMetric(metric);

    return this;
  }

  increment(
    name: string,
    value: number,
    options: Micra.CustomStatsMetricOptions = {},
  ): this {
    const metric = this._stats.find((m) => m.name === name && m.type === 'c');

    if (metric) {
      metric.value += value;
    } else {
      this.count(name, value, options);
    }

    return this;
  }

  decrement(
    name: string,
    value: number,
    options: Micra.CustomStatsMetricOptions = {},
  ): this {
    const metric = this._stats.find((m) => m.name === name && m.type === 'c');

    if (metric) {
      metric.value -= value;
    } else {
      this.count(name, -value, options);
    }

    return this;
  }

  gauge(
    name: string,
    value: number,
    options: Micra.CustomStatsMetricOptions = {},
  ): this {
    const metric = new StatsMetric({
      name: [this.prefix, name],
      value,
      type: 'g',
      sampleRate: options.sampleRate || this._sampleRate,
      tags: Object.assign({}, this._tags ?? {}, options?.tags ?? {}),
      extras: Object.assign({}, this._extras ?? {}, options?.extras ?? {}),
    });

    this.pushMetric(metric);

    return this;
  }

  timing(
    name: string,
    value: number,
    options: Micra.CustomStatsMetricOptions = {},
  ): this {
    const metric = new StatsMetric({
      name: [this.prefix, name],
      value,
      type: 'ms',
      sampleRate: options.sampleRate || this._sampleRate,
      tags: Object.assign({}, this._tags ?? {}, options?.tags ?? {}),
      extras: Object.assign({}, this._extras ?? {}, options?.extras ?? {}),
    });

    this.pushMetric(metric);

    return this;
  }

  startTimer(
    name: string,
    options: Micra.CustomStatsMetricOptions = {},
  ): () => void {
    const startedAt = performance.now();

    return () => {
      const endedAt = performance.now();
      this.timing(name, endedAt - startedAt, options);
    };
  }

  set(
    name: string,
    value: number,
    options: Micra.CustomStatsMetricOptions = {},
  ): this {
    const metric = new StatsMetric({
      name: [this.prefix, name],
      value,
      type: 's',
      sampleRate: options.sampleRate || this._sampleRate,
      tags: Object.assign({}, this._tags ?? {}, options?.tags ?? {}),
      extras: Object.assign({}, this._extras ?? {}, options?.extras ?? {}),
    });

    this.pushMetric(metric);

    return this;
  }

  histogram(
    name: string,
    value: number,
    options: Micra.CustomStatsMetricOptions = {},
  ): this {
    const metric = new StatsMetric({
      name: [this.prefix, name],
      value,
      type: 'h',
      sampleRate: options.sampleRate || this._sampleRate,
      tags: Object.assign({}, this._tags ?? {}, options?.tags ?? {}),
      extras: Object.assign({}, this._extras ?? {}, options?.extras ?? {}),
    });

    this.pushMetric(metric);

    return this;
  }

  addConsumer(cb: Micra.StatsConsumer): () => void {
    this._consumers.set(cb, {
      consumed: [],
      listener: cb,
    });

    return () => {
      this.removeConsumer(cb);
    };
  }

  removeConsumer(cb: Micra.StatsConsumer): this {
    this._consumers.delete(cb);
    return this;
  }

  send(payload: Micra.StatsMetric): this {
    const shouldSend =
      !payload.sampleRate ||
      this._marsenne.genrandReal2() <= payload.sampleRate;

    this._consumers.forEach((listener) => {
      if (listener.consumed.includes(payload.id)) {
        return;
      }

      listener.consumed.push(payload.id);
      if (shouldSend) {
        listener.listener(payload);
      }
    });

    return this;
  }

  createScope(options: Micra.StatsScopeOptions): Stats {
    const scope = new Stats({
      ...options,
      prefix: [
        ...(this._prefix ?? []),
        ...(Array.isArray(options.prefix) ? options.prefix : [options.prefix]),
      ],
      extras: Object.assign({}, this._extras ?? {}, options?.extras ?? {}),
      metrics: {
        ...this._metric,
        keepMetrics: true,
        flushInterval: -1,
      },
    });

    this._scopes.add(scope);

    return scope;
  }
}
