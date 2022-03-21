import { sortModules, } from '../../src/services/mod-sort'
import { Module, } from '../../src/modules/interfaces'

const fakeMod = (name: string, dependencies: string[]) => ({
  name,
  version: '0.0.1',
  dependencies,
} as Module);

describe('Module Sorting', () => {
  it('should sort from root to leaf order', () => {
    const root = fakeMod('root', []);
    const middle = fakeMod('middle', ['root@0.0.1']);
    const leaf1 = fakeMod('leaf1', ['root@0.0.1']);
    const leaf2 = fakeMod('leaf2', ['middle@0.0.1']);
    const sortedList = sortModules([leaf1, leaf2, middle, root], []);
    expect(sortedList[0]).toBe(root);
    expect(sortedList.indexOf(middle)).toBeLessThan(sortedList.indexOf(leaf2));
  });

  it('should sort child nodes correctly if root is excluded', () => {
    const root = fakeMod('root', []);
    const middle = fakeMod('middle', ['root@0.0.1']);
    const leaf1 = fakeMod('leaf1', ['root@0.0.1']);
    const leaf2 = fakeMod('leaf2', ['middle@0.0.1']);
    const sortedList = sortModules([leaf1, leaf2, middle, root], ['root@0.0.1']);
    expect(sortedList.indexOf(middle)).toBeLessThan(sortedList.indexOf(leaf2));
  });
});