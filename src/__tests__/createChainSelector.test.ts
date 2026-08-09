import { createSelector, createSelectorCreator, setGlobalDevModeChecks } from '@veksa/reselect';
import { createCachedSelector } from '@veksa/re-reselect';
import { createChainSelector, CreateSelectorOptions } from '../createChainSelector';
import { createBoundSelector } from '../createBoundSelector';
import { commonState, MessageStateSegment, PersonStateSegment, State } from '../__data__/state';
import { createPathSelector } from '../createPathSelector';
import { createPropSelector } from '../createPropSelector';
import { createKeySelectorCreator } from '../keys/createKeySelectorCreator';
import { stringComposeKeySelectors } from '../keys/stringComposeKeySelectors';
import { arrayComposeKeySelectors } from '../keys/arrayComposeKeySelectors';
import { createSequenceSelector } from '../createSequenceSelector';
import { CachedSelector, NamedSelector } from '../types';
import { isCachedSelector } from '../_helpers/isCachedSelector';
import { defaultKeySelector } from '../keys/defaultKeySelector';

vi.mock('../debug/debug', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  isDebugMode: vi.fn(() => true),
}));

describe('createChainSelector', () => {
  const personsSelector = (state: PersonStateSegment) => {
    return state.persons;
  };

  const personSelector = createCachedSelector(
    [createPathSelector(personsSelector).data(), createPropSelector<{ id: number }>().id()],
    (data, id) => {
      return data[id];
    },
  )({
    keySelector: createPropSelector<{ id: number }>().id(),
  });

  const messagesSelector = (state: MessageStateSegment) => {
    return state.messages;
  };

  const messageSelector = (state: MessageStateSegment, props: { id: number }) => {
    return state.messages.data[props.id];
  };

  const fullNameSelector = createSelector(
    [personSelector],
    ({ firstName = '', secondName = '' }) => {
      return `${firstName} ${secondName}`;
    },
  );

  const fullNameCachedSelector = createCachedSelector(
    [personSelector],
    ({ firstName = '', secondName = '' }) => {
      return `${firstName} ${secondName}`;
    },
  )((_state, props) => props.id);

  afterEach(() => {
    fullNameCachedSelector.clearCache();
    fullNameCachedSelector.resetRecomputations();
  });

  beforeAll(() => {
    setGlobalDevModeChecks({
      inputStabilityCheck: 'never',
      identityFunctionCheck: 'never',
    });
  });

  test('should implement simple selector chain', () => {
    const personByMessageIdSelector = createChainSelector(messageSelector)
      .chain((message) => {
        return createBoundSelector(personSelector, {
          id: message.personId,
        });
      })
      .chain((person) => {
        return createBoundSelector(fullNameSelector, {
          id: person.id,
        });
      })
      .build();

    expect(personByMessageIdSelector(commonState, { id: 100 })).toBe('Marry Poppins');
    expect(personByMessageIdSelector(commonState, { id: 200 })).toBe('Harry Potter');
  });

  test('should implement simple optional selection', () => {
    const currentMessageSelector = createChainSelector(
      createPathSelector(messagesSelector).currentMessageId(),
    )
      .chain((messageId) => {
        return createBoundSelector(messageSelector, {
          id: messageId,
        });
      })
      .build();

    expect(currentMessageSelector(commonState).personId).toBe(2);
    expect(createPathSelector(currentMessageSelector).personId()(commonState)).toBe(2);
  });

  test('should implement path chain selector for name property', () => {
    const personByMessageIdSelector = createChainSelector(
      createPathSelector(personsSelector).currentPersonId(),
    )
      .chain((personId) => {
        return createBoundSelector(personSelector, {
          id: personId,
        });
      })
      .build();

    expect(createPathSelector(personByMessageIdSelector).firstName()(commonState)).toBe('Marry');
    expect(createPathSelector(personByMessageIdSelector).name()(commonState)).toBe('M Poppins');
  });

  test('should cached chain callback by result of input selector', () => {
    const selectorStub = () => '';
    const chainMock = vi.fn(() => selectorStub);

    const someByMessageIdSelector = createChainSelector(messageSelector).chain(chainMock).build();

    someByMessageIdSelector(commonState, { id: 100 });
    someByMessageIdSelector(commonState, { id: 100 });
    someByMessageIdSelector(commonState, { id: 100 });

    expect(chainMock).toHaveBeenCalledTimes(1);

    someByMessageIdSelector(commonState, { id: 200 });

    expect(chainMock).toHaveBeenCalledTimes(2);
  });

  test('should not mutate dependencies of chaining selectors', () => {
    const firstPersonSelector = createBoundSelector(personSelector, {
      id: 1,
    });

    const firstPersonMonadicSelector = createChainSelector(() => '')
      .chain(() => firstPersonSelector)
      .build();

    const firstDependencies = firstPersonSelector.dependencies;
    firstPersonMonadicSelector(commonState);
    const secondDependencies = firstPersonSelector.dependencies;

    expect(firstDependencies?.length).toBeDefined();
    expect(firstDependencies?.length).toBe(secondDependencies?.length);
  });

  test('should not invalidate cache for input parametric selector', () => {
    const chainFn = vi.fn((result: string) => () => result);
    const fullNameProxyCachedSelector = createChainSelector(fullNameCachedSelector)
      .chain(chainFn)
      .build();

    fullNameProxyCachedSelector(commonState, { id: 1 });
    fullNameProxyCachedSelector(commonState, { id: 2 });
    fullNameProxyCachedSelector(commonState, { id: 1 });
    fullNameProxyCachedSelector(commonState, { id: 2 });

    expect(fullNameCachedSelector.recomputations()).toBe(2);
    expect(chainFn).toHaveBeenCalledTimes(2);
  });

  test('should not invalidate cache for input path parametric selector', () => {
    const personCachedSelector = createCachedSelector([personSelector], (person) => {
      return person;
    })((_state, props) => props.id);

    const chainFn = vi.fn((result?: string) => () => result);

    const nameProxyCachedSelector = createChainSelector(
      createPathSelector(personCachedSelector).firstName(),
    )
      .chain(chainFn)
      .build();

    nameProxyCachedSelector(commonState, { id: 1 });
    nameProxyCachedSelector(commonState, { id: 2 });
    nameProxyCachedSelector(commonState, { id: 1 });
    nameProxyCachedSelector(commonState, { id: 2 });

    expect(chainFn).toHaveBeenCalledTimes(2);
  });

  test('should not invalidate cached selector with composingKeySelectorCreator', () => {
    const cachedPersonSelector = createCachedSelector(
      [
        (state: State) => state.persons,
        (_state: State, props: { personId: number }) => props.personId,
      ],
      (persons, personId) => {
        return persons.data[personId];
      },
    )({
      keySelector: (_state: State, props: { personId: number }) => props.personId,
    });

    const cachedMessageSelector = createCachedSelector(
      [
        (state: State) => state.messages.data,
        (_state: State, props: { messageId: number }) => props.messageId,
      ],
      (messages, messageId) => {
        return messages[messageId];
      },
    )({
      keySelector: (_state: State, props: { messageId: number }) => props.messageId,
    });

    const personByMessageIdSelector = createChainSelector(cachedMessageSelector)
      .chain((message) => {
        return createBoundSelector(cachedPersonSelector, {
          personId: message.personId,
        });
      })
      .build();

    const fullNameByMessageSelector = createCachedSelector(
      [personByMessageIdSelector],
      ({ firstName = '', secondName = '' }) => {
        return `${firstName} ${secondName}`;
      },
    )({
      keySelectorCreator: createKeySelectorCreator(stringComposeKeySelectors),
    });

    expect(fullNameByMessageSelector(commonState, { messageId: 100 })).toBe('Marry Poppins');
    expect(fullNameByMessageSelector(commonState, { messageId: 200 })).toBe('Harry Potter');

    expect(fullNameByMessageSelector(commonState, { messageId: 100 })).toBe('Marry Poppins');
    expect(fullNameByMessageSelector(commonState, { messageId: 200 })).toBe('Harry Potter');

    expect(fullNameByMessageSelector.recomputations()).toBe(2);
  });

  test('should build cached selector with few levels of chaining', () => {
    const firstKeySelector = createPropSelector<{
      firstProp: string;
    }>().firstProp();

    const secondKeySelector = createPropSelector<{
      secondProp: string;
    }>().secondProp();

    const firstSelector = createCachedSelector(
      firstKeySelector,
      (firstProp) => firstProp,
    )({
      keySelector: firstKeySelector,
    });

    const secondSelector = createCachedSelector(
      secondKeySelector,
      (secondProp) => secondProp,
    )({
      keySelector: secondKeySelector,
    });

    const chainFn = vi.fn((result: string) => () => result);

    const chainSelector = createChainSelector(firstSelector)
      .chain(() => secondSelector)
      .chain(chainFn)
      .build();

    chainSelector(expect.anything(), {
      firstProp: 'firstValue',
      secondProp: 'firstValue',
    });

    chainSelector(expect.anything(), {
      firstProp: 'firstValue',
      secondProp: 'secondValue',
    });

    chainSelector(expect.anything(), {
      firstProp: 'secondValue',
      secondProp: 'firstValue',
    });

    chainSelector(expect.anything(), {
      firstProp: 'secondValue',
      secondProp: 'secondValue',
    });

    chainSelector(expect.anything(), {
      firstProp: 'firstValue',
      secondProp: 'firstValue',
    });

    chainSelector(expect.anything(), {
      firstProp: 'firstValue',
      secondProp: 'secondValue',
    });

    chainSelector(expect.anything(), {
      firstProp: 'secondValue',
      secondProp: 'firstValue',
    });

    chainSelector(expect.anything(), {
      firstProp: 'secondValue',
      secondProp: 'secondValue',
    });

    expect(chainFn).toHaveBeenCalledTimes(4);
    expect(firstSelector.recomputations()).toBe(2);
    expect(secondSelector.recomputations()).toBe(2);
  });

  test('should keep per key memoization for map levels over a cached selector', () => {
    const mapFn = vi.fn((person?: { firstName?: string }) => person?.firstName ?? '');

    const firstNameSelector = createChainSelector(personSelector).map(mapFn).build();

    firstNameSelector(commonState, { id: 1 });
    firstNameSelector(commonState, { id: 2 });
    firstNameSelector(commonState, { id: 1 });
    firstNameSelector(commonState, { id: 2 });

    expect(mapFn).toHaveBeenCalledTimes(2);
  });

  test('should propagate the key selector of the base through map levels', () => {
    const mappedSelector = createChainSelector(personSelector)
      .map((person) => person?.firstName)
      .map((firstName) => firstName ?? '')
      .build();

    // A `map` level never derives a cached selector, so its key is the base's own
    // and is handed over as is instead of being recomposed per level.
    expect((mappedSelector as unknown as CachedSelector).keySelector).toBe(
      personSelector.keySelector,
    );
  });

  test('should build a keyless level with the configured selector creator', () => {
    const selectorCreator = vi.fn(createSelector);

    const createSelectorOptions = () =>
      ({ selectorCreator }) as unknown as CreateSelectorOptions<typeof createSelectorCreator>;

    const personIdSelector = createChainSelector(messageSelector)
      .map((message) => message.personId, { createSelectorOptions })
      .build();

    expect(personIdSelector(commonState, { id: 100 })).toBe(1);
    expect(selectorCreator).toHaveBeenCalled();
  });

  test('should build a keyed level with the configured cache object', () => {
    const cacheObject = {
      set: vi.fn(),
      get: vi.fn(),
      remove: vi.fn(),
      clear: vi.fn(),
    };

    const createSelectorOptions = () =>
      ({ cacheObject }) as unknown as CreateSelectorOptions<typeof createSelectorCreator>;

    const firstNameSelector = createChainSelector(personSelector)
      .map((person) => person?.firstName, { createSelectorOptions })
      .build();

    firstNameSelector(commonState, { id: 1 });

    // The base is keyed, so the level keeps its cache — and it is the configured
    // one that receives the entry.
    expect(cacheObject.set).toHaveBeenCalled();
  });

  test('should keep the hit rate of a chain level over an uncached selector', () => {
    const chainMock = vi.fn((message: { personId: number }) => {
      return createBoundSelector(personSelector, { id: message.personId });
    });

    // The base is a plain selector, so this level carries no key and is built as
    // a plain memoized selector. Alternating between two results must still hit.
    const personByMessageIdSelector = createChainSelector(messageSelector).chain(chainMock).build();

    personByMessageIdSelector(commonState, { id: 100 });
    personByMessageIdSelector(commonState, { id: 200 });
    personByMessageIdSelector(commonState, { id: 100 });
    personByMessageIdSelector(commonState, { id: 200 });

    expect(chainMock).toHaveBeenCalledTimes(2);
    expect(personByMessageIdSelector(commonState, { id: 100 }).firstName).toBe('Marry');
    expect(personByMessageIdSelector(commonState, { id: 200 }).firstName).toBe('Harry');
    expect(chainMock).toHaveBeenCalledTimes(2);
  });

  test('should compose the key of a map level with the chain composer', () => {
    const firstKeySelector = createPropSelector<{ first: string }>().first();
    const secondKeySelector = createPropSelector<{ second: string }>().second();

    const arrayKeyedSelector = createCachedSelector(
      [firstKeySelector, secondKeySelector],
      (first, second) => `${first}${second}`,
    )({
      keySelector: arrayComposeKeySelectors(firstKeySelector, secondKeySelector),
    });

    const mappedSelector = createChainSelector(arrayKeyedSelector)
      .map((value) => value.length)
      .build();

    const keySelector = (mappedSelector as unknown as CachedSelector).keySelector;

    // The base composes an array key, but the level is cached with whatever the
    // chain's own composer produces — a flat cache object cannot take an array.
    expect(keySelector(expect.anything(), { first: 'a', second: 'b' })).toBe('a:b');
  });

  test('should not build a keyed cache when the key cannot vary', () => {
    const mapFn = vi.fn((message: { personId: number }) => message.personId);

    const personIdSelector = createChainSelector(messageSelector).map(mapFn).map(String).build();

    expect(isCachedSelector(personIdSelector)).toBe(false);

    // Dropping the cache changes nothing about memoization: a constant key means
    // a single cache entry, which is what a plain memoized selector already is.
    personIdSelector(commonState, { id: 100 });
    personIdSelector(commonState, { id: 100 });
    personIdSelector(commonState, { id: 100 });

    expect(mapFn).toHaveBeenCalledTimes(1);
  });

  test('should keep the key selector of a chain level whose derived selector may be cached', () => {
    // A `chain` level cannot know at build time what it will derive, so unlike a
    // `map` level it carries a key selector even over an uncached base. The key
    // it resolves to is the default one, which is what makes the level itself
    // skip the cache while still letting a level above compose from it.
    const personSelectorByMessage: any = createChainSelector(messageSelector)
      .chain((message) => (state: State) => state.persons.data[message.personId])
      .build();

    expect('keySelector' in personSelectorByMessage).toBe(true);
    expect('cache' in personSelectorByMessage).toBe(false);
    expect(personSelectorByMessage.keySelector(commonState, { id: 100 })).toBe(
      defaultKeySelector(),
    );

    // Reading it still memoizes per key, which is what the cache would have done.
    expect(personSelectorByMessage(commonState, { id: 100 }).firstName).toBe('Marry');
    expect(personSelectorByMessage(commonState, { id: 200 }).firstName).toBe('Harry');
  });

  test('should implement aggregation for collection by single item selector', () => {
    const personsSelector = (state: State) => state.persons;

    const longestFullNameSelector = createChainSelector(personsSelector)
      .chain((persons) => {
        return createSequenceSelector(
          Object.values(persons.data).map((person) => {
            return createBoundSelector(fullNameSelector, { id: person.id });
          }),
        );
      })
      .map((fullNames) => {
        return fullNames.reduce((longest, current) => {
          return current.length > longest.length ? current : longest;
        });
      })
      .build();

    expect(longestFullNameSelector(commonState)).toBe('Marry Poppins');
  });

  test('should generate selector name', () => {
    const fullNameNamedSelector = createSelector(
      [personSelector],
      ({ firstName = '', secondName = '' }) => {
        return `${firstName} ${secondName}`;
      },
    );

    (fullNameNamedSelector as NamedSelector<unknown, unknown, [unknown], unknown>).selectorName =
      'fullNameNamedSelector';

    const personByMessageIdSelector: any = createChainSelector(messageSelector)
      .chain((message) => {
        return createBoundSelector(personSelector, { id: message.personId });
      })
      .chain((person) => {
        return createBoundSelector(fullNameNamedSelector, { id: person.id });
      })
      .build();

    expect(personByMessageIdSelector.selectorName).toMatchInlineSnapshot(
      `"messageSelector (will be chained (message) => { return __vi_import_3__.createBoundSelector(personSelector, { id: message.personId }); }) (will be chained (person) => { return __vi_import_3__.createBoundSelector(fullNameNamedSelector, { id: person.id }); })"`,
    );

    personByMessageIdSelector(commonState, { id: 100 });

    expect(personByMessageIdSelector.selectorName).toMatchInlineSnapshot(
      `"messageSelector (chained by selector (id -> [*])) (chained by fullNameNamedSelector (id -> [*]))"`,
    );

    const [higherOrderSelector] = personByMessageIdSelector.dependencies as unknown[];

    expect(
      (higherOrderSelector as NamedSelector<unknown, unknown>).selectorName,
    ).toMatchInlineSnapshot(
      `"higher order for messageSelector (chained by selector (id -> [*])) ((person) => { return __vi_import_3__.createBoundSelector(fullNameNamedSelector, { id: person.id }); })"`,
    );
  });

  test('should let an assigned selector name win over the generated one', () => {
    const personIdSelector: any = createChainSelector(messageSelector)
      .map((message) => message.personId)
      .build();

    expect(personIdSelector.selectorName).toContain('messageSelector');

    // The generated name is exposed through a getter, and the matching setter is
    // what lets a caller pin a readable name on a built chain.
    personIdSelector.selectorName = 'personIdSelector';

    expect(personIdSelector.selectorName).toBe('personIdSelector');
  });

  test('should build selector with chainHierarchy property for unit test', () => {
    type FirstState = { firstValue: string };

    const firstSelector = (state: FirstState) => {
      return state.firstValue;
    };
    const firstChain = () => firstSelector;

    type SecondState = { secondValue: number };
    type SecondProps = { prop: boolean };

    const secondSelector = (state: SecondState, props: SecondProps) => {
      return `${state.secondValue} ${String(props.prop)}`;
    };
    const secondChain = () => secondSelector;

    const someByMessageIdSelector = createChainSelector(messageSelector)
      .chain(firstChain)
      .chain(secondChain)
      .build();

    expect(someByMessageIdSelector.chainHierarchy).toBeDefined();

    const lastChain = someByMessageIdSelector.chainHierarchy;

    expect(lastChain?.('firstValue')).toBe(secondSelector);
    expect(lastChain?.('firstValue')({ secondValue: 2 }, { prop: true })).toBe('2 true');

    const lastButOneChain = someByMessageIdSelector.chainHierarchy?.parentChain;

    expect(lastButOneChain?.(expect.anything())).toBe(firstSelector);
    expect(lastButOneChain?.(expect.anything())({ firstValue: 'firstValue' })).toBe('firstValue');
  });
});
