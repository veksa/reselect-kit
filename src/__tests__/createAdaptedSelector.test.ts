import { createCachedSelector } from '@veksa/re-reselect';
import { commonState, State } from '../__data__/state';
import { createAdaptedSelector } from '../createAdaptedSelector';
import { createStructuredSelector } from '../createStructuredSelector';
import { NamedParametricSelector } from '../types';
import { isCachedSelector } from '../_helpers/isCachedSelector';

vi.mock('../debug/debug', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  isDebugMode: vi.fn(() => true),
}));

describe('createAdaptedSelector', () => {
  const personSelector = (state: State, props: { id: number }) => state.persons.data[props.id];
  const messageSelector = (state: State, props: { id: number }) => state.messages.data[props.id];

  const personAdaptedSelector = createAdaptedSelector(
    personSelector,
    (props: { personId: number }) => ({
      id: props.personId,
    }),
  );
  const messageAdaptedSelector = createAdaptedSelector(
    messageSelector,
    (props: { messageId: number }) => ({
      id: props.messageId,
    }),
  );

  const personAndMessageSelector = createStructuredSelector({
    person: personAdaptedSelector,
    message: messageAdaptedSelector,
  });

  test('should implement adaptation of selector by mapping function', () => {
    const actual = personAndMessageSelector(commonState, {
      personId: 1,
      messageId: 100,
    });

    expect(actual.person.firstName).toBe('Marry');
    expect(actual.message.text).toBe('Hello');
  });

  test('should generate selector name', () => {
    expect(personAdaptedSelector.selectorName).toMatchInlineSnapshot(
      `"personSelector (id -> personId)"`,
    );
    expect(messageAdaptedSelector.selectorName).toMatchInlineSnapshot(
      `"messageSelector (id -> messageId)"`,
    );

    const personAndMessageNamedSelector = createStructuredSelector({
      person: personAdaptedSelector,
      message: messageAdaptedSelector,
    });
    (
      personAndMessageNamedSelector as NamedParametricSelector<unknown, unknown, unknown>
    ).selectorName = 'personAndMessageNamedSelector';

    const personAndMessageAdaptedSelector = createAdaptedSelector(
      personAndMessageNamedSelector,
      (props: { inputPersonId: number; inputMessageId: number }) => ({
        personId: props.inputPersonId,
        messageId: props.inputMessageId,
      }),
    );

    expect(personAndMessageAdaptedSelector.selectorName).toMatchInlineSnapshot(
      `"personAndMessageNamedSelector (personId,messageId -> inputPersonId,inputMessageId)"`,
    );

    const mapPersonAndMessageProps = (props: {
      inputPersonId: number;
      inputMessageId: number;
    }) => ({
      personId: props.inputPersonId,
      messageId: props.inputMessageId,
    });

    const personAndMessageAdaptedWithNamedMapperSelector = createAdaptedSelector(
      personAndMessageNamedSelector,
      mapPersonAndMessageProps,
    );

    expect(personAndMessageAdaptedWithNamedMapperSelector.selectorName).toMatchInlineSnapshot(
      `"personAndMessageNamedSelector (mapPersonAndMessageProps)"`,
    );
  });

  describe('integration with re-reselect', () => {
    const fullNameCachedSelector = createCachedSelector(
      [personSelector],
      ({ firstName = '', secondName = '' }) => `${firstName} ${secondName}`,
    )((_state, props) => props.id);

    test('should decorate getMatchingSelector and removeMatchingSelector of dependency', () => {
      const fullNameAdaptedCachedSelector = createAdaptedSelector(
        fullNameCachedSelector,
        (props: { personId: number }) => ({
          id: props.personId,
        }),
      );

      if (!isCachedSelector(fullNameAdaptedCachedSelector)) {
        throw new Error('fullNameAdaptedCachedSelector should be cached');
      }

      let selectorInstance = fullNameAdaptedCachedSelector.getMatchingSelector?.(commonState, {
        personId: 1,
      });
      expect(selectorInstance).toBeUndefined();

      fullNameAdaptedCachedSelector(commonState, { personId: 1 });
      selectorInstance = fullNameAdaptedCachedSelector.getMatchingSelector?.(commonState, {
        personId: 1,
      });
      expect(selectorInstance).toBeInstanceOf(Function);

      fullNameAdaptedCachedSelector.removeMatchingSelector?.(commonState, {
        personId: 1,
      });
      selectorInstance = fullNameAdaptedCachedSelector.getMatchingSelector?.(commonState, {
        personId: 1,
      });
      expect(selectorInstance).toBeUndefined();

      const key = fullNameAdaptedCachedSelector.keySelector(commonState, {
        personId: 1,
      }) as unknown;
      expect(key).toBe(1);
    });
  });
});
