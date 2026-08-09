import { describe, expect, test, vi } from 'vitest';
import { createSelector } from '@veksa/reselect';
import { commonState, State } from '../__data__/state';
import { createSequenceSelector } from '../createSequenceSelector';

describe('createSequenceSelector', () => {
  test('combines input selector results into an ordered array', () => {
    const selector = createSequenceSelector([
      (state: State) => state.persons.currentPersonId,
      (state: State) => state.messages.currentMessageId,
    ]);

    expect(selector(commonState)).toEqual([1, 200]);
  });

  test('memoizes the result while inputs are unchanged', () => {
    const selector = createSequenceSelector([(state: State) => state.persons.currentPersonId]);

    const first = selector(commonState);
    const second = selector(commonState);

    expect(second).toBe(first);
  });

  test('recomputes when an input selector result changes', () => {
    const selector = createSequenceSelector([(state: State) => state.persons.currentPersonId]);

    const first = selector(commonState);
    const nextState: State = {
      ...commonState,
      persons: { ...commonState.persons, currentPersonId: 2 },
    };
    const second = selector(nextState);

    expect(second).not.toBe(first);
    expect(second).toEqual([2]);
  });

  test('passes props through to parametric input selectors', () => {
    const selector = createSequenceSelector([
      (_state: State, props: { personId: number }) => props.personId,
      (state: State) => state.persons.currentPersonId ?? 0,
    ]);

    expect(selector(commonState, { personId: 7 })).toEqual([7, 1]);
  });

  test('uses the provided selector creator', () => {
    const selectorCreator = vi.fn(createSelector);

    createSequenceSelector(
      [(state: State) => state.persons.currentPersonId],
      selectorCreator as unknown as typeof createSelector,
    );

    expect(selectorCreator).toHaveBeenCalledTimes(1);
  });
});
