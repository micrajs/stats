/// <reference types="./register" />
function generateId(prefix = 'id') {
  return [
    prefix,
    (Math.random() + 1).toString(36).substring(2),
    (Math.random() + 1).toString(36).substring(2),
  ].join('-');
}

class MersenneTwister19937 {
  private readonly N = 624;
  private readonly M = 397;
  private readonly MATRIX_A = 0x9908b0df;
  private readonly UPPER_MASK = 0x80000000;
  private readonly LOWER_MASK = 0x7fffffff;
  private mt: number[] = new Array(this.N);
  private mti = this.N + 1;

  private unsigned32(n1: number): number {
    return n1 < 0 ? (n1 ^ this.UPPER_MASK) + this.UPPER_MASK : n1;
  }

  private addition32(n1: number, n2: number): number {
    return this.unsigned32((n1 + n2) & 0xffffffff);
  }

  private multiplication32(n1: number, n2: number): number {
    let sum = 0;
    for (let i = 0; i < 32; ++i) {
      if ((n1 >>> i) & 0x1) {
        sum = this.addition32(sum, this.unsigned32(n2 << i));
      }
    }
    return sum;
  }

  initGenrand(seed: number): void {
    this.mt[0] = this.unsigned32(seed & 0xffffffff);
    for (this.mti = 1; this.mti < this.N; this.mti++) {
      this.mt[this.mti] = this.addition32(
        this.multiplication32(
          1812433253,
          this.unsigned32(
            this.mt[this.mti - 1] ^ (this.mt[this.mti - 1] >>> 30),
          ),
        ),
        this.mti,
      );
      this.mt[this.mti] = this.unsigned32(this.mt[this.mti] & 0xffffffff);
    }
  }

  private mag01 = [0x0, this.MATRIX_A];

  genrandInt32(): number {
    let y: number;
    if (this.mti >= this.N) {
      let kk: number;

      if (this.mti === this.N + 1) {
        this.initGenrand(5489);
      } /* a default initial seed is used */

      for (kk = 0; kk < this.N - this.M; kk++) {
        y = this.unsigned32(
          (this.mt[kk] & this.UPPER_MASK) | (this.mt[kk + 1] & this.LOWER_MASK),
        );
        this.mt[kk] = this.unsigned32(
          this.mt[kk + this.M] ^ (y >>> 1) ^ this.mag01[y & 0x1],
        );
      }
      for (; kk < this.N - 1; kk++) {
        y = this.unsigned32(
          (this.mt[kk] & this.UPPER_MASK) | (this.mt[kk + 1] & this.LOWER_MASK),
        );
        this.mt[kk] = this.unsigned32(
          this.mt[kk + (this.M - this.N)] ^ (y >>> 1) ^ this.mag01[y & 0x1],
        );
      }

      y = this.unsigned32(
        (this.mt[this.N - 1] & this.UPPER_MASK) |
          (this.mt[0] & this.LOWER_MASK),
      );
      this.mt[this.N - 1] = this.unsigned32(
        this.mt[this.M - 1] ^ (y >>> 1) ^ this.mag01[y & 0x1],
      );
      this.mti = 0;
    }

    y = this.mt[this.mti++];

    y = this.unsigned32(y ^ (y >>> 11));
    y = this.unsigned32(y ^ ((y << 7) & 0x9d2c5680));
    y = this.unsigned32(y ^ ((y << 15) & 0xefc60000));
    y = this.unsigned32(y ^ (y >>> 18));

    return y;
  }

  genrandReal2(): number {
    return this.genrandInt32() * (1.0 / 4294967296.0);
  }
}
class StatsMetric implements Micra.StatsMetric {
  id: string;
  value: number;
  type: Micra.StatsMetricType;
  sampleRate?: number;
  _name: string[];
  tags?: Record<string, string>;
  extras?: Record<string, any>;

  constructor({
    name,
    value,
    type,
    sampleRate,
    tags,
    extras,
  }: Micra.MetricOptions) {
    this.value = value;
    this.type = type;
    this.sampleRate = sampleRate;
    this._name = Array.isArray(name) ? name : [name];
    this.tags = tags;
    this.id = generateId('metric');
    this.extras = extras;
  }

  get name(): string {
    return this._name.filter(Boolean).join('.');
  }

  toString(): string {
    const parts = [`${this.name}:${this.value}`, this.type];

    if (this.sampleRate) {
      parts.push(`@${this.sampleRate}`);
    }

    if (!!this.tags && Object.keys(this.tags).length > 0) {
      parts.push(
        `#${Object.entries(this.tags!)
          .map(([k, v]) => `${k}:${v}`)
          .join(',')}`,
      );
    }

    return parts.join('|');
  }
}

interface StatsListener {
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
