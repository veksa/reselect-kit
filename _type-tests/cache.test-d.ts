import { expectTypeOf } from 'expect-type';
import { ICacheObject } from '@veksa/re-reselect';
import { TreeCache, IntervalMapCache, initGarbageCollector } from '../src/index';

// both cache implementations satisfy the re-reselect cache contract
expectTypeOf(new TreeCache({})).toExtend<ICacheObject>();
expectTypeOf(new IntervalMapCache()).toExtend<ICacheObject>();

// the garbage collector initializer takes no arguments
expectTypeOf(initGarbageCollector).toEqualTypeOf<() => void>();

// TreeCache accepts an optional cache object factory
new TreeCache({ cacheObjectCreator: () => new IntervalMapCache() });

// TreeCache requires an options object
// @ts-expect-error - options argument is required
new TreeCache();
