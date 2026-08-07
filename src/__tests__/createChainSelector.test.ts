import { createSelector, setGlobalDevModeChecks } from '@veksa/reselect';
import { createCachedSelector } from '@veksa/re-reselect';
import { createChainSelector } from '../createChainSelector';
import { createBoundSelector } from '../createBoundSelector';
import { commonState, MessageStateSegment, PersonStateSegment, State } from '../__data__/state';
import { createPathSelector } from '../createPathSelector';
import { createPropSelector } from '../createPropSelector';
import { createKeySelectorCreator } from '../keys/createKeySelectorCreator';
import { stringComposeKeySelectors } from '../keys/stringComposeKeySelectors';
import { createSequenceSelector } from '../createSequenceSelector';
import { NamedParametricSelector, NamedSelector } from '../types';

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

    (
      fullNameNamedSelector as NamedParametricSelector<unknown, unknown, unknown, unknown>
    ).selectorName = 'fullNameNamedSelector';

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
