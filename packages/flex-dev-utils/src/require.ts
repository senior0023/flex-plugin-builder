import appModule from 'app-module-path';
import { join } from 'path';

export default appModule;

/**
 * Adds the node_modules to the app module.
 * This is needed because we spawn different scripts when running start/build/test and so we lose the original cwd directory
 */
export const addCWDNodeModule = () => appModule.addPath(join(process.cwd(), 'node_modules'));

/**
 * Returns the absolute path to the pkg if found
 * @param pkg the package to lookup
 */
export const resolveModulePath = (pkg: string) => {
  try {
    return require.resolve(pkg);
  } catch (e) {
    return false;
  }
};
