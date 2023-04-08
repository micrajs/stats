import {generateId} from '../utilities/generateId';

export class StatsMetric implements Micra.StatsMetric {
  id: string;
  value: number;
  type: Micra.StatsMetricType;
  sampleRate?: number;
  emittedAt: Date;
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
    this.emittedAt = new Date();
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
