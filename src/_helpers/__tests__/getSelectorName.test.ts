import { getSelectorName } from '../getSelectorName';

describe('getSelectorName', () => {
  test('prefers the debug name a selector was tagged with', () => {
    const selector = Object.assign((state: unknown) => state, {
      selectorName: 'personSelector',
    });

    expect(getSelectorName(selector)).toBe('personSelector');
  });

  test('falls back to the function name when there is no debug name', () => {
    function messageSelector(state: unknown) {
      return state;
    }

    expect(getSelectorName(messageSelector)).toBe('messageSelector');
  });

  test('falls back to the function name when the debug name is empty', () => {
    const selector = Object.assign(
      function personSelector(state: unknown) {
        return state;
      },
      { selectorName: '' },
    );

    expect(getSelectorName(selector)).toBe('personSelector');
  });
});
