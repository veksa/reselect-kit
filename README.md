# reselect-kit

[![npm version](https://img.shields.io/npm/v/reselect-kit.svg?style=flat-square)](https://www.npmjs.com/package/reselect-kit)
[![npm downloads](https://img.shields.io/npm/dm/reselect-kit.svg?style=flat-square)](https://www.npmjs.com/package/reselect-kit)
[![license](https://img.shields.io/badge/license-MIT-blue.svg?style=flat-square)](LICENSE.md)

A powerful toolkit that extends the capabilities of @veksa/reselect and @veksa/re-reselect by providing utilities for advanced selector composition, safe property access, and optimized caching. This library helps you build more maintainable and efficient Redux selectors with enhanced type safety and functional programming patterns.

> **About this package**
>
> `reselect-kit` continues [sgrishchenko/reselect-utils](https://github.com/sgrishchenko/reselect-utils),
> keeping its full commit history. That project is no longer maintained, so the
> work moved here under a new name rather than staying on a fork of a dormant
> repository. The API is the same — only the package name changed, from
> `@veksa/reselect-utils` to `reselect-kit`.

## Features

- **Chain Selector Pattern** - Build selector pipelines with fluent interfaces for complex data transformations
- **Powerful Path Selectors** - Safely traverse and select nested object properties with protection against null/undefined
- **Bound Selectors** - Create selectors with predefined parameters for reuse across components
- **Adapted Selectors** - Transform selector parameters to simplify composition and reuse
- **Enhanced Structured Selectors** - Better typed alternatives to createStructuredSelector with caching support
- **Batched Store Reads** - Read a whole group of selectors through a single store subscription with `useSelectors`
- **Key Selector Composition** - Compose key selectors for complex cache keys in re-reselect
- **Custom Caching** - Optimize performance with advanced garbage collection and cache strategies
- **TypeScript Support** - Full TypeScript type definitions with strict typing

## Installation

reselect-kit requires **TypeScript 5.4 or later** — the floor the type tests run
against on every commit, together with every minor up to 7.0.

### Using npm or yarn

```bash
# npm
npm install reselect-kit

# yarn
yarn add reselect-kit
```

### Upgrading from 1.0.x

Props are no longer a type parameter of their own: a selector is typed by the
tuple of arguments it takes after `state`, and a parametric selector is simply
one whose tuple is not empty. Call sites that let the types be inferred are
unaffected. Ones that spell the type arguments out move the props into the tuple:

```typescript
// before
useSelector<State, PersonProps, Person>(getPerson, { personId: 1 });
createPathSelector<State, Person, PersonProps>(getPerson);
createChainSelector<State, PersonProps, Person>(getPerson);

// after
useSelector<State, Person, [PersonProps]>(getPerson, { personId: 1 });
createPathSelector<State, Person, [PersonProps]>(getPerson);
createChainSelector<State, Person, [PersonProps]>(getPerson);
```

`createCachedSequenceSelector` infers everything from the array it is given, so
its type arguments cannot be written out at all — annotate `state` in the
selectors instead.

Two more consequences of the same change:

- a sequence returns a tuple of the individual result types rather than `R[]`,
  which is what makes each position keep its own type;
- a chain step that reads props now makes them required for the whole built
  selector even when the base selector had none. That type used to be dropped,
  so this surfaces as a new error on code that was already passing the props.

## Examples

### Comparing @veksa/reselect, @veksa/re-reselect, and reselect-kit

#### Problem: Working with optional nested data

Imagine we need to select a nested property from a state object that might not exist at every level.

#### @veksa/reselect implementation

```typescript
import { createSelector } from '@veksa/reselect';

const getUser = (state) => state.user;

const getUserAddress = createSelector(getUser, (user) => {
  // Need null checks at each level
  if (user && user.contact && user.contact.address) {
    return user.contact.address;
  }
  return undefined;
});

// Usage:
const address = getUserAddress(state); // May be undefined
```

With standard @veksa/reselect, you need to handle potential null/undefined values at each level with conditional checks.

#### @veksa/re-reselect solution

```typescript
import { createCachedSelector } from '@veksa/re-reselect';

const getUser = (state) => state.user;
const getUserId = (state, userId) => userId;

// Using re-reselect for caching by userId
const getUserAddressByUserId = createCachedSelector(getUser, getUserId, (user, userId) => {
  // Still need null checks for nested properties
  const targetUser = user[userId];
  if (targetUser && targetUser.contact && targetUser.contact.address) {
    return targetUser.contact.address;
  }
  return undefined;
})((state, userId) => userId);

// Usage with better caching by userId:
const address = getUserAddressByUserId(state, '123');
```

@veksa/re-reselect adds caching benefits but still requires the same null checks for property access.

#### reselect-kit solution

```typescript
import { createPathSelector } from 'reselect-kit';

// Clean path selection with built-in null handling
const getUser = createPathSelector((state) => state.user);

// For parametric selectors
const getUserByUserId = createPathSelector((state, props) => state.users?.[props.userId]);

// Walking the path builds a selector; calling it reads the store
const address = getUser.address()(state); // Safely returns undefined if path is broken
const userAddress = getUserByUserId.address()(state, { userId: '123' }); // With parameters
```

reselect-kit provides safer property access with path selectors that handle null/undefined values automatically.

### Basic Usage Patterns

#### Segment Selector

```typescript
import { createSegmentSelector } from 'reselect-kit';

interface IUserStore {
  address: string;
}

interface IUserSegment {
  user: IUserStore;
}

const defaultUser: IUserStore = { address: 'Default address' };

const getUserSegment = createSegmentSelector<IUserSegment, IUserStore>(
  (state) => state.user,
  defaultUser,
);
```

#### Path Selector

```typescript
import { createPathSelector } from 'reselect-kit';

const state = {
  user: {
    address: 'Some user address',
  },
};

const getUserAddress = createPathSelector((state) => state.user).address();
```

#### Prop Selector

```typescript
import { createPropSelector } from 'reselect-kit';

const getUserIdFromProps = createPropSelector<{ userId: number }>().userId();
```

#### Bound Selector

```typescript
import { createSelector } from '@veksa/reselect';
import { createBoundSelector } from 'reselect-kit';

const getUserByName = createSelector(
  (state) => state.users,
  (state, props) => props.userName,
  (users, userName) => users[userName],
);

const getAdmin = createBoundSelector(getUserByName, { userName: 'admin' });

// Usage:
const admin = getAdmin(state); // Same as getUserByName(state, {userName: 'admin'})
```

#### Adapted Selector

```typescript
import { createSelector } from '@veksa/reselect';
import { createAdaptedSelector } from 'reselect-kit';

const getUserByNameAndRole = createSelector(
  (state) => state.users,
  (state, props) => props.userName,
  (state, props) => props.userRole,
  (users, userName, userRole) => users[userName][userRole],
);

const getAdmin = createAdaptedSelector(getUserByNameAndRole, (props: { name: string }) => ({
  userName: props.name,
  userRole: 'admin',
}));

// Usage: the adapted selector takes the props the mapping accepts
const admin = getAdmin(state, { name: 'alice' });
// Same as getUserByNameAndRole(state, {userName: 'alice', userRole: 'admin'})
```

#### Chain Selectors

```typescript
import { createChainSelector } from 'reselect-kit';

// Create a base selector
const getUserData = (state) => state.users;

// Build a selector chain
const getActiveUserEmails = createChainSelector(getUserData)
  .map((users) => users.filter((user) => user.active))
  .map((activeUsers) => activeUsers.map((user) => user.email))
  .build();

// Usage:
const activeEmails = getActiveUserEmails(state); // ['alice@example.com', 'bob@example.com']
```

## Advanced Examples

### Using Structured Selectors

```typescript
import { createCachedStructuredSelector } from 'reselect-kit';

const getUserProfile = createCachedStructuredSelector({
  name: (state) => state.user.name,
  email: (state) => state.user.email,
  address: createPathSelector((state) => state.user).contact.address(),
})({
  keySelector: (state, props) => props.userId,
});

// Usage:
const profile = getUserProfile(state, { userId: '123' });
// Returns: { name: 'John', email: 'john@example.com', address: { ... } }
```

### Reading a Batch of Selectors in a Component

The same structural idea at the call site: `useSelectors` takes an object of
selectors and reads them all through one store subscription.

```typescript
import { useSelectors } from 'reselect-kit';

const QuoteRow = ({ symbol }) => {
  const { bid, ask, volume } = useSelectors({ bid: getBid, ask: getAsk, volume: getVolume }, { symbol });

  return <Row bid={bid} ask={ask} volume={volume} />;
};
```

Which of the two to use is a question of where the memoization should live, not
of speed — they perform the same:

|              | `createCachedStructuredSelector`              | `useSelectors`                   |
| ------------ | --------------------------------------------- | -------------------------------- |
| What it is   | a selector: composable, usable outside React  | a read at the call site only     |
| Memoization  | one module-level cache, keyed                 | one slot per component instance  |
| Cache key    | a key selector is required                    | none                             |
| Cache sizing | must hold every live row, or it thrashes      | dies with the component          |
| Sharing      | two components with the same key compute once | every component computes its own |

Reuse the batch elsewhere, or feed it into another selector — build a structured
selector. If the batch is simply "what this component reads", reach for the hook
and skip the key selector and the cache sizing.

### Key Selector Composition

```typescript
import { stringComposeKeySelectors } from 'reselect-kit';

// Compose several key selectors into a single one. `stringComposeKeySelectors`
// joins the composed keys with `:`.
const keySelector = stringComposeKeySelectors(
  (state, props) => props.userId,
  (state, props) => props.view,
);

// Usage:
// keySelector(state, { userId: '123', view: 'details' }) returns '123:details'
```

## API Reference

### Core Functions

#### createChainSelector

Creates a selector that can be chained with map and chain methods.

```typescript
createChainSelector(baseSelector).map(transformFn).build();
```

##### ChainSelector Methods

###### chain

Transforms the output of the previous selector by creating a new selector based on its result. This is where the real power of chain selectors comes in, allowing composition of selectors where the output of one becomes the context for creating the next.

```typescript
chain<S2, R2, Params2>(
  fn: (result: R1) => (state: S2, ...params: Params2) => R2,
  options?: ChainSelectorOptions,
): ChainSelectorResult
```

- **fn** - Function that receives the previous selector's result and returns a new selector
- **options** - Optional configuration for caching and key selection

A step reading props adds them to what the built selector requires, whether or
not the base selector had any: the arguments of every level are merged rather
than the level having to match the base.

**Examples:**

```typescript
// Basic chaining - transform one selector's result into another selector
const userWithDetails = createChainSelector((state) => state.users)
  .chain((users) => (state) => {
    // This function receives the users result and returns a new selector
    const userIds = Object.keys(users);
    return userIds.map((id) => state.userDetails[id]);
  })
  .build();

// Parametric selectors with chain
const getUserPostsById = createChainSelector(propSelector)
  .chain((props) => {
    // Use the props to create a targeted selector
    return createSelector(
      (state) => state.users[props.userId],
      (state) => state.posts,
      (user, posts) => posts.filter((post) => post.authorId === user.id),
    );
  })
  .build();

// Multiple chains
const getUserStats = createChainSelector((state) => state.users)
  .chain((users) => (state) => Object.values(users).filter((user) => user.active))
  .chain((activeUsers) => (state) => ({
    activeCount: activeUsers.length,
    totalCount: Object.keys(state.users).length,
    activeRatio: activeUsers.length / Object.keys(state.users).length,
  }))
  .build();
```

###### map

Transforms the output of the selector with a simple transformation function. Unlike `chain`, `map` doesn't create a new selector but just transforms the result of the current one.

```typescript
map<R2>(fn: (result: R1) => R2, options?: ChainSelectorOptions): SelectorMonad
```

###### Keyed levels

A level only gets a keyed cache when its key can actually vary. Where the key is
a constant, the cache would hold a single entry for the lifetime of the chain
while every call still paid for the key computation and the lookup guarding it,
so the level is built as a plain memoized selector instead — the same mapping
without the layer.

What each level knows about its key differs:

- a `map` level derives a plain `() => output`, never a cached selector, so its
  key is its base's own and is composed once at build time. A chain of `map`s
  over a plain (uncached) selector composes to the default key, and the built
  selector then carries neither `keySelector` nor `cache`;
- a `chain` level cannot know its key at build time, because the selector it
  derives exists only per call and may itself be cached — chaining a bound
  cached selector off a plain base is the ordinary case. So it always carries a
  `keySelector` that resolves the derived selector's key. Over an uncached base
  that key evaluates to the default, but it is not the default _selector_, so a
  level built on top of it does take the keyed path and holds a single entry.

Chaining off a cached selector is where those caches earn their keep.

###### build

Completes the chain and returns the final selector function that can be used in components.

```typescript
build(): Selector<S, R, Params>
```

#### createPathSelector

Creates a selector that safely accesses nested properties. Property access walks
the path and the call terminates it, producing the selector.

```typescript
createPathSelector(sourceSelector).some.nested.path();
```

#### createBoundSelector

Creates a selector with predefined props. Whatever the binding does not supply
stays required; a binding covering every prop leaves a plain selector.

```typescript
createBoundSelector(selector, binding);
```

#### createAdaptedSelector

Adapts a selector to work with a different props shape. The adapted selector
takes the props the mapping accepts, in place of the ones the base selector reads.

```typescript
createAdaptedSelector(selector, propsAdapter);
```

#### createCachedStructuredSelector

Creates a structured selector with caching support. The second call takes either
re-reselect's options object or the key selector on its own.

```typescript
createCachedStructuredSelector(selectors)({ keySelector });
```

The key selector is typed from the batch, so its `state` and props are the ones
the batch reads.

The second call needs a way to derive the key: a `keySelector`, given on its own
or inside the options, or a `keySelectorCreator` that produces one. re-reselect
types both as optional, so an options object carrying neither compiles and then
throws on the first read.

#### createEmptySelector

Creates a selector that always returns `undefined` regardless of input. Useful as a placeholder or for conditional selection logic.

```typescript
const emptySelector = createEmptySelector(baseSelector);
// Always returns undefined; the result widens to `R | undefined` and the
// selector takes whatever arguments it is called with
```

#### createPropSelector

Creates a selector that returns the props passed to it, enabling strongly-typed access to props in selector chains.

```typescript
const propSelector = createPropSelector();
// Usage: propSelector(state, props) returns props

// In a chain
const userByIdSelector = createChainSelector(propSelector)
  .chain((props) => createPathSelector((state) => state.users[props.userId]).profile())
  .build();
```

#### createSegmentSelector

Creates a selector with a default/initial value when the selection returns null or undefined.

```typescript
const getUserSettings = createSegmentSelector(
  (state) => state.userSettings,
  { theme: 'light', notifications: true }, // Default value if userSettings is null/undefined
);
```

#### createSequenceSelector

Runs a group of selectors and collects their results positionally. The result is
a tuple of the individual result types, and `state` and the extra arguments are
merged across the group, so a single parametric member makes props required for
the whole sequence.

```typescript
const getUserStats = createSequenceSelector([
  (state) => state.user.postsCount,
  (state) => state.user.followersCount,
  (state) => state.user.likesCount,
]);

// getUserStats(state) returns [postsCount, followersCount, likesCount]
```

#### createCachedSequenceSelector

The cached counterpart of `createSequenceSelector`: the second call takes
re-reselect's options, with the key selector typed from the group.

```typescript
const getPostStats = createCachedSequenceSelector([
  (state, props) => state.posts[props.postId].likes,
  (state, props) => state.posts[props.postId].comments,
])({
  keySelector: (state, props) => props.postId,
});

// getPostStats(state, { postId: 1 }) returns [likes, comments]
```

### Hooks

#### useSelector

Reads one selector from the store. Props are compared shallowly, so an inline
object literal does not invalidate the selector on every render.

```typescript
const price = useSelector(getPrice, { symbol });
```

#### useSelectors

Reads a batch of selectors through a **single** store subscription and returns
their results as one object.

```typescript
const { symbol, bid, ask } = useSelectors(
  { symbol: getSymbol, bid: getBid, ask: getAsk },
  { symbol },
);
```

The props argument follows the batch: it is rejected when no selector takes
props, required as soon as one requires them, and optional when every selector
that reads props declares them optional. The props of the batch are intersected,
so one object satisfies every member.

Every member is read as `selector(state, props)`, so a selector that requires a
third argument does not belong in a batch — the batch has nothing to pass for it
and it arrives as `undefined`.

Seven `useSelector` calls in a row component mean seven store listeners, seven
`useSyncExternalStore` instances and seven snapshot comparisons per dispatch;
`useSelectors` collapses them into one of each. The result object keeps its
reference while every field is unchanged, so an update that touches nothing the
row reads does not re-render it.

The trade-off against separate hooks is granularity: any tracked state segment
changing re-runs the whole batch, which for memoized selectors is a cache hit
per field. See [Reading a Batch of Selectors in a Component](#reading-a-batch-of-selectors-in-a-component)
for how this compares with a structured selector.

### Key Selectors

#### stringComposeKeySelectors

Composes several key selectors into one that joins their keys with `:`. The
result carries its inputs as `dependencies`, which is what lets
`createBoundSelector` drop the key selectors whose props it has bound.

```typescript
const keySelector = stringComposeKeySelectors(
  (state, props) => props.userId,
  (state, props) => props.view,
);

// keySelector(state, { userId: '123', view: 'details' }) returns '123:details'
```

#### arrayComposeKeySelectors

The same composition, producing an array key instead of a string — for cache
objects that take multi-part keys, such as [TreeCache](#treecache). Nested array
keys are flattened.

```typescript
const keySelector = arrayComposeKeySelectors(
  (state, props) => props.userId,
  (state, props) => props.view,
);

// keySelector(state, { userId: '123', view: 'details' }) returns ['123', 'details']
```

#### createKeySelectorComposer

Builds a composer of your own from a function that reduces N key selectors into
one. Both composers above are built with it.

```typescript
const commaComposeKeySelectors = createKeySelectorComposer(
  (...keySelectors) =>
    (state, props) =>
      keySelectors.map((keySelector) => keySelector(state, props)).join(),
);
```

#### createKeySelectorCreator

Builds the `keySelectorCreator` that re-reselect calls to derive a selector's key
from its inputs: it collects the key selectors of every cached input, flattens
already-composed ones, drops duplicates and the default key, and composes what is
left with the given composer.

```typescript
const fullNameSelector = createCachedSelector(
  [personByMessageIdSelector],
  toFullName,
)({
  keySelectorCreator: createKeySelectorCreator(stringComposeKeySelectors),
});
```

A chain builds its own creator from the `keySelectorComposer` it was given, so
inside a chain the composer is what you configure, not the creator.

#### defaultKeySelector

The key of a selector that has nothing to key on — a single constant. Key
composition drops it, so a chain whose key cannot vary carries no cache at all.

#### ChainSelectorOptions

The options every chain level accepts, either on `createChainSelector` itself or
per `chain` / `map` call. A per-level object overrides what the chain was created
with, and the merged result carries to the levels after it.

```typescript
type ChainSelectorOptions = {
  // called per level, so each one gets its own cache object
  createSelectorOptions?: () => { selectorCreator; cacheObject };
  keySelectorComposer?: KeySelectorComposer;
};
```

### Debugging

#### setDebugMode / isDebugMode

Debug mode makes every creator tag the selectors it builds with a readable
`selectorName`, composed from the names of what they were built from. It is off
by default, since the names cost string work on every build.

```typescript
import { setDebugMode } from 'reselect-kit';

setDebugMode(process.env.NODE_ENV !== 'production');
```

### Cache Objects

#### TreeCache

Implements a hierarchical cache structure for nested key support. Unlike flat cache objects, TreeCache allows for efficiently caching and retrieving selectors with complex, multi-part keys.

Pair it with [arrayComposeKeySelectors](#arraycomposekeyselectors), which is what
produces the multi-part keys it exists for.

```typescript
import { FlatObjectCache } from '@veksa/re-reselect';
import { TreeCache } from 'reselect-kit';

// The options object is required; `cacheObjectCreator` inside it is not, and
// defaults to a FlatObjectCache per level
const cache = new TreeCache({
  cacheObjectCreator: () => new FlatObjectCache(),
});

// Use with complex keys (automatically normalized to arrays)
const complexKey = ['user', 123, 'profile'];
cache.set(complexKey, selectorInstance);
const selector = cache.get(complexKey);
```

#### IntervalMapCache and Garbage Collection

A time-based cache implementation with automatic garbage collection for unused selectors to prevent memory leaks.

```typescript
import { IntervalMapCache, initGarbageCollector } from 'reselect-kit';

// Initialize garbage collector to clean up stale cache entries
initGarbageCollector();

// Create a cache that automatically manages memory
const cache = new IntervalMapCache();

// Items not accessed within the cache lifetime will be automatically purged
cache.set('key', selectorData);
```

The sweep runs on a 10-second interval and evicts entries untouched for that
long; reading an entry refreshes it. `initGarbageCollector` schedules through
`window`, so it is a no-op where there is none — on the server the cache simply
keeps what it is given. Calling it more than once does not stack collectors.

### Comparing with @veksa/reselect and @veksa/re-reselect

| Feature                     | @veksa/reselect | @veksa/re-reselect | reselect-kit         |
| --------------------------- | --------------- | ------------------ | -------------------- |
| Basic memoization           | ✓               | ✓                  | ✓ (via dependencies) |
| Parametric memoization      | ×               | ✓                  | ✓ (via dependencies) |
| Safe nested property access | ×               | ×                  | ✓                    |
| Fluent selector chains      | ×               | ×                  | ✓                    |
| Parameter binding           | ×               | ×                  | ✓                    |
| Parameter adaptation        | ×               | ×                  | ✓                    |
| Advanced key composition    | ×               | Limited            | ✓                    |
| Cache garbage collection    | ×               | ×                  | ✓                    |
| Hierarchical caching        | ×               | ×                  | ✓                    |
| Props-aware React hooks     | ×               | ×                  | ✓                    |
| Batched store subscription  | ×               | ×                  | ✓                    |
| Typescript support          | ✓               | ✓                  | ✓ (enhanced)         |

## Contributing

This project welcomes contributions and suggestions. Feel free to submit a Pull Request.

## License

[MIT](LICENSE.md)
