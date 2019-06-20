import fs from 'fs';
import * as path from 'path';
import os from 'os';

export default fs;

const rootDir = os.platform() === 'win32' ? process.cwd().split(path.sep)[0] : '/';

/**
 * Checks the provided array of files exist
 *
 * @param files the files to check that they exist
 */
export const checkFilesExist = (...files: string[]) => {
  return files
    .map(fs.existsSync)
    .every((resp) => resp);
};

/**
 * Gets package.json path
 */
export const getPackageJsonPath = (forModule: boolean = false) => path.join(process.cwd(), 'package.json');

/**
 * Updates the package.json version field
 *
 * @param version the new version
 */
export const updatePackageVersion = (version: string) => {
  const packageJson = readPackageJson();
  packageJson.version = version;

  fs.writeFileSync(getPackageJsonPath(), JSON.stringify(packageJson, null, 2));
};

/**
 * Reads package.json
 *
 * @param pkgPath   the package.json to read
 */
export const readPackageJson = (pkgPath: string = getPackageJsonPath()) => {
  return JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
};

/**
 * Finds the closest up file relative to dir
 *
 * @param dir   the directory
 * @param file  the file to look for
 */
export const findUp = (dir: string, file: string): string => {
  const resolved = path.resolve(dir);

  if (resolved === rootDir) {
    throw new Error(`Reached OS root directory without findin ${file}`);
  }

  const filePath = path.join(resolved, file);
  if (fs.existsSync(filePath)) {
    return filePath;
  }

  return findUp(path.resolve(resolved, '..'), file);
};
