import { sortModules, } from '../../src/services/mod-sort'
import { ModuleInterface, } from '../../src/modules/interfaces'

const fakeMod = (name: string, dependencies: string[]) => ({
  name,
  dependencies,
} as ModuleInterface);

describe('Module Sorting', () => {
  it('should sort from root to leaf order', () => {
    const root = fakeMod('root', []);
    const middle = fakeMod('middle', ['root']);
    const leaf1 = fakeMod('leaf1', ['root']);
    const leaf2 = fakeMod('leaf2', ['middle']);
    const sortedList = sortModules([leaf1, leaf2, middle, root], []);
    expect(sortedList[0]).toBe(root);
    expect(sortedList.indexOf(middle)).toBeLessThan(sortedList.indexOf(leaf2));
  });

  it('should sort child nodes correctly if root is excluded', () => {
    const root = fakeMod('root', []);
    const middle = fakeMod('middle', ['root']);
    const leaf1 = fakeMod('leaf1', ['root']);
    const leaf2 = fakeMod('leaf2', ['middle']);
    const sortedList = sortModules([leaf1, leaf2, middle, root], ['root']);
    expect(sortedList.indexOf(middle)).toBeLessThan(sortedList.indexOf(leaf2));
  });
});