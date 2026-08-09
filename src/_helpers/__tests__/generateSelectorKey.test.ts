import { generateSelectorKey } from '../generateSelectorKey';

describe('generateSelectorKey', () => {
  test('stringifies a selector that has no dependencies', () => {
    const selector = (state: { id: number }) => state.id;

    expect(generateSelectorKey(selector)).toBe('(state) => state.id');
  });

  test('appends every dependency, so selectors sharing a body still differ', () => {
    const first = (state: { id: number }) => state.id;
    const second = (state: { id: number }) => state.id;

    const withFirst = Object.assign((state: { id: number }) => state.id, {
      dependencies: [first],
    });
    const withBoth = Object.assign((state: { id: number }) => state.id, {
      dependencies: [first, second],
    });

    expect(generateSelectorKey(withFirst)).not.toBe(generateSelectorKey(withBoth));
    expect(generateSelectorKey(withBoth)).toContain('(state) => state.id');
  });
});
