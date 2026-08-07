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
- **Key Selector Composition** - Compose key selectors for complex cache keys in re-reselect
- **Custom Caching** - Optimize performance with advanced garbage collection and cache strategies
- **TypeScript Support** - Full TypeScript type definitions with strict typing

## Installation

reselect-kit requires **TypeScript 5.8 or later**.

### Using npm or yarn

```bash
# npm
npm install reselect-kit

# yarn
yarn add reselect-kit
```

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
const getUserByUserId = createPathSelector((state, userId) => state.users?.[userId]);

// Usage:
const address = getUser(state).address(); // Safely returns undefined if path is broken
const userAddress = getUserByUserId(state, '123').address(); // With parameters
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

const getAdmin = createAdaptedSelector(getUserByNameAndRole, (props) => ({
  userName: props.userName,
  userRole: 'admin',
}));

// Usage:
const admin = getAdmin(state); // Same as getUserByName(state, {userName: 'admin'})
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
  address: createPathSelector(
    (state) => state.user,
    (user) => user?.contact?.address,
  ),
})((state, userId) => userId);

// Usage:
const profile = getUserProfile(state, '123');
// Returns: { name: 'John', email: 'john@example.com', address: { ... } }
```

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
chain<S2, R2>(fn: (result: R1) => Selector<S2, R2>, options?: ChainSelectorOptions): SelectorMonad
chain<S2, P2, R2>(fn: (result: R1) => Selector<S2, R2, [P2]>, options?: ChainSelectorOptions): SelectorMonad
```

- **fn** - Function that receives the previous selector's result and returns a new selector
- **options** - Optional configuration for caching and key selection

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

###### build

Completes the chain and returns the final selector function that can be used in components.

```typescript
build(): Selector<S, R, Params>
```

#### createPathSelector

Creates a selector that safely accesses nested properties.

```typescript
createPathSelector(sourceSelector, pathFn);
```

#### createBoundSelector

Creates a selector with predefined parameters.

```typescript
createBoundSelector(selector, getParams);
```

#### createAdaptedSelector

Adapts a selector to work with a different parameter shape.

```typescript
createAdaptedSelector(selector, paramsAdapter);
```

#### createCachedStructuredSelector

Creates a structured selector with caching support.

```typescript
createCachedStructuredSelector(selectors)(keySelector);
```

#### createEmptySelector

Creates a selector that always returns `undefined` regardless of input. Useful as a placeholder or for conditional selection logic.

```typescript
const emptySelector = createEmptySelector(baseSelector);
// Always returns undefined while maintaining the original selector's signature
```

#### createPropSelector

Creates a selector that returns the props passed to it, enabling strongly-typed access to props in selector chains.

```typescript
const propSelector = createPropSelector();
// Usage: propSelector(state, props) returns props

// In a chain
const userByIdSelector = createChainSelector(propSelector)
  .chain((props) =>
    createPathSelector(
      (state) => state.users[props.userId],
      (user) => user,
    ),
  )
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

Creates a selector that returns an array of results from multiple selectors.

```typescript
const getUserStats = createSequenceSelector([
  (state) => state.user.postsCount,
  (state) => state.user.followersCount,
  (state) => state.user.likesCount,
]);

// Returns [postsCount, followersCount, likesCount]
```

### Cache Objects

#### TreeCache

Implements a hierarchical cache structure for nested key support. Unlike flat cache objects, TreeCache allows for efficiently caching and retrieving selectors with complex, multi-part keys.

```typescript
import { TreeCache } from 'reselect-kit';

// Create a TreeCache instance
const cache = new TreeCache({
  cacheObjectCreator: () => new FlatObjectCache(), // Optional custom cache factory
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
| Typescript support          | ✓               | ✓                  | ✓ (enhanced)         |

## Contributing

This project welcomes contributions and suggestions. Feel free to submit a Pull Request.

## License

[MIT](LICENSE.md)
