import {Stats} from '../Stats';
import {StatsMetric} from '../StatsMetric';

describe('Stats tests', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  it('creates a count metric', () => {
    const telemetry = new Stats();
    const metric = new StatsMetric({
      name: 'test',
      value: 1,
      type: 'c',
    });
    telemetry.count('test', 1);

    expect(telemetry._stats.length).toBe(1);

    expect(telemetry._stats[0].toString()).toBe(metric.toString());
  });

  it('creates a gauge metric', () => {
    const telemetry = new Stats();
    const metric = new StatsMetric({
      name: 'test',
      value: 1,
      type: 'g',
    });
    telemetry.gauge('test', 1);

    expect(telemetry._stats.length).toBe(1);

    expect(telemetry._stats[0].toString()).toBe(metric.toString());
  });

  it('creates a timing metric', () => {
    const telemetry = new Stats();
    const metric = new StatsMetric({
      name: 'test',
      value: 1,
      type: 'ms',
    });
    telemetry.timing('test', 1);

    expect(telemetry._stats.length).toBe(1);

    expect(telemetry._stats[0].toString()).toBe(metric.toString());
  });

  it('increments a count metric', () => {
    const telemetry = new Stats();
    telemetry.count('test', 1);
    telemetry.increment('test', 1);

    expect(telemetry._stats.length).toBe(1);

    expect(telemetry._stats[0].value).toBe(2);
  });

  it('decrements a count metric', () => {
    const telemetry = new Stats();
    telemetry.count('test', 1);
    telemetry.decrement('test', 1);

    expect(telemetry._stats.length).toBe(1);

    expect(telemetry._stats[0].value).toBe(0);
  });

  it('increments a count metric with a negative value', () => {
    const telemetry = new Stats();
    telemetry.count('test', 1);
    telemetry.increment('test', -1);

    expect(telemetry._stats.length).toBe(1);

    expect(telemetry._stats[0].value).toBe(0);
  });

  it('decrements a count metric with a negative value', () => {
    const telemetry = new Stats();
    telemetry.count('test', 1);
    telemetry.decrement('test', -1);

    expect(telemetry._stats.length).toBe(1);

    expect(telemetry._stats[0].value).toBe(2);
  });

  it('emits metrics to a consumer after 1000ms', () => {
    const telemetry = new Stats();
    const consumer = vi.fn();
    telemetry.addConsumer(consumer);

    telemetry.count('test', 1);
    telemetry.gauge('test', 1);
    telemetry.timing('test', 1);

    vi.advanceTimersByTime(1000);

    expect(consumer).toHaveBeenCalledTimes(3);
  });

  it('emits only a given metric to a consumer once', () => {
    const telemetry = new Stats({
      metrics: {flushInterval: -1, keepMetrics: true},
    });
    const consumer = vi.fn();
    telemetry.addConsumer(consumer);
    telemetry.count('test', 1);

    telemetry.flush();
    telemetry.flush();

    expect(consumer).toHaveBeenCalledTimes(1);
  });

  it('emits metrics to multiple consumers after 1000ms', () => {
    const telemetry = new Stats();
    const consumer1 = vi.fn();
    const consumer2 = vi.fn();
    telemetry.addConsumer(consumer1);
    telemetry.addConsumer(consumer2);

    telemetry.count('test', 1);
    telemetry.gauge('test', 1);
    telemetry.timing('test', 1);

    vi.advanceTimersByTime(1000);

    expect(consumer1).toHaveBeenCalledTimes(3);
    expect(consumer2).toHaveBeenCalledTimes(3);
  });

  it('emits metrics to a consumer after a custom interval', () => {
    const telemetry = new Stats({
      metrics: {
        flushInterval: 500,
      },
    });
    const consumer = vi.fn();
    telemetry.addConsumer(consumer);

    telemetry.count('test', 1);
    telemetry.gauge('test', 1);
    telemetry.timing('test', 1);

    vi.advanceTimersByTime(500);

    expect(consumer).toHaveBeenCalledTimes(3);
  });

  it('emits metrics immediately', () => {
    const telemetry = new Stats({metrics: {flushInterval: 0}});
    const consumer = vi.fn();
    telemetry.addConsumer(consumer);

    telemetry.count('test', 1);
    expect(consumer).toHaveBeenCalledTimes(1);
    telemetry.gauge('test', 1);
    expect(consumer).toHaveBeenCalledTimes(2);
    telemetry.timing('test', 1);
    expect(consumer).toHaveBeenCalledTimes(3);
  });

  it('sets a custom prefix', () => {
    const telemetry = new Stats({prefix: 'test'});

    telemetry.count('test', 1);

    expect(telemetry._stats[0].toString()).toBe('test.test:1|c');
  });

  it('sets a list of prefixes', () => {
    const telemetry = new Stats({prefix: ['test', 'test2']});

    telemetry.count('test', 1);

    expect(telemetry._stats[0].toString()).toBe('test.test2.test:1|c');
  });

  it('sets tags', () => {
    const telemetry = new Stats({tags: {test: 'test'}});

    telemetry.count('test', 1);

    expect(telemetry._stats[0].toString()).toBe('test:1|c|#test:test');
  });

  it('sets a defaults sample rate', () => {
    const telemetry = new Stats({sampleRate: 0.5});

    telemetry.count('test', 1);

    expect(telemetry._stats[0].toString()).toBe('test:1|c|@0.5');
  });

  it('sets a sample rate for a metric', () => {
    const telemetry = new Stats();

    telemetry.count('test', 1, {sampleRate: 0.5});

    expect(telemetry._stats[0].toString()).toBe('test:1|c|@0.5');
  });

  it('sets a sample rate for a metric with tags', () => {
    const telemetry = new Stats();

    telemetry.count('test', 1, {sampleRate: 0.5, tags: {test: 'test'}});

    expect(telemetry._stats[0].toString()).toBe('test:1|c|@0.5|#test:test');
  });

  it('creates a new scope', () => {
    const telemetry = new Stats({prefix: 'test'});
    const scope = telemetry.createScope({prefix: 'test'});

    scope.count('test', 1);

    expect(scope._stats[0].toString()).toBe('test.test.test:1|c');
  });

  it('emits metrics to the main scope from a child scope', () => {
    const telemetry = new Stats({prefix: 'test'});
    const scope = telemetry.createScope({prefix: 'test'});
    const consumer = vi.fn();
    telemetry.addConsumer(consumer);

    scope.count('test', 1);

    vi.advanceTimersByTime(1000);

    expect(consumer).toHaveBeenCalledTimes(1);
  });
});
