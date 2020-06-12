import fs from 'fs';
import { join } from 'path';

import * as requireScripts from 'flex-dev-utils/dist/require';
import * as fsScripts from 'flex-dev-utils/dist/fs';
import * as prints from '../../prints';
import * as checkStartScript from '../check-start';
import * as inquirer from 'flex-dev-utils/dist/inquirer';

jest.mock('flex-dev-utils/dist/logger');
jest.mock('../../prints/versionMismatch');
jest.mock('../../prints/unbundledReactMismatch');
jest.mock('../../prints/appConfigMissing');
jest.mock('../../prints/publicDirCopyFailed');
jest.mock('../../prints/expectedDependencyNotFound');
jest.mock('../../prints/typescriptNotInstalled');
jest.mock('../../prints/loadPluginCountError');
jest.mock('flex-dev-utils/dist/paths', () => ({
  scripts: {
    tsConfigPath: 'test-ts-config-path',
    dir: 'test-scripts-dir',
  },
  cli: {
    dir: 'test-dir',
    flex: 'test-dir-flex',
    pluginsJsonPath: 'test-dir-plugins',
  },
  app: {
    version: '1.0.0',
    name: 'plugin-test',
    dir: 'test-dir',
    nodeModulesDir: 'test-node-modules',
    appConfig: 'appConfig.js',
  },
  assetBaseUrlTemplate: 'template',
}));

// tslint:disable-next-line
const lernaVersion = require(join(process.cwd(), 'node_modules/lerna/package.json')).version;

describe('CheckStartScript', () => {
  // @ts-ignore
  const exit = jest.spyOn(process, 'exit').mockImplementation(() => { /* no-op */ });
  const OLD_ENV = process.env;

  beforeEach(() => {
    jest.resetAllMocks();
    jest.resetModules();

    process.env = { ...OLD_ENV };
  });

  describe('main', () => {
    const _checkAppConfig = jest
      .spyOn(checkStartScript, '_checkAppConfig')
      .mockReturnThis();
    const _checkPublicDirSync = jest
      .spyOn(checkStartScript, '_checkPublicDirSync')
      .mockReturnThis();
    const _checkExternalDepsVersions = jest
      .spyOn(checkStartScript, '_checkExternalDepsVersions')
      .mockReturnThis();
    const _validateTypescriptProject = jest
      .spyOn(checkStartScript, '_validateTypescriptProject')
      .mockReturnValue(undefined);
    const _checkPluginCount = jest
      .spyOn(checkStartScript, '_checkPluginCount')
      .mockReturnValue(undefined);

    beforeEach(() => {
      _checkAppConfig.mockReset();
      _checkPublicDirSync.mockReset();
      _checkExternalDepsVersions.mockReset();
      _validateTypescriptProject.mockReset();
      _checkPluginCount.mockReset();
    });

    afterAll(() => {
      _checkAppConfig.mockRestore();
      _checkPublicDirSync.mockRestore();
      _checkExternalDepsVersions.mockRestore();
      _validateTypescriptProject.mockRestore();
      _checkPluginCount.mockRestore();
    });

    const expectCalled = (allowSkip: boolean, allowReact: boolean) => {
      expect(_checkAppConfig).toHaveBeenCalledTimes(1);
      expect(_checkPublicDirSync).toHaveBeenCalledTimes(1);
      expect(_checkExternalDepsVersions).toHaveBeenCalledTimes(1);
      expect(_validateTypescriptProject).toHaveBeenCalledTimes(1);
      expect(_checkExternalDepsVersions).toHaveBeenCalledWith(allowSkip, allowReact);
      expect(_checkPluginCount).toHaveBeenCalledTimes(1);
    };

    it('should call all methods', async () => {
      await checkStartScript.default();

      expectCalled(false, false);
    });

    it('should call all methods and allow skip', async () => {
      process.env.SKIP_PREFLIGHT_CHECK = 'true';
      await checkStartScript.default();

      expectCalled(true, false);
    });

    it('should call all methods and allow react', async () => {
      process.env.UNBUNDLED_REACT = 'true';
      await checkStartScript.default();

      expectCalled(false, true);
    });
  });

  describe('_checkAppConfig', () => {
    it('quit if no appConfig is found', () => {
      const existSync = jest
        .spyOn(fs, 'existsSync')
        .mockReturnValue(false);

      checkStartScript._checkAppConfig();

      expect(existSync).toHaveBeenCalledTimes(1);
      expect(existSync).toHaveBeenCalledWith(expect.stringContaining('appConfig.js'));
      expect(prints.appConfigMissing).toHaveBeenCalledTimes(1);
      expect(exit).toHaveBeenCalledTimes(1);
      expect(exit).toHaveBeenCalledWith(1);

      existSync.mockRestore();
    });

    it('not quit if appConfig is found', () => {
      const existSync = jest
        .spyOn(fs, 'existsSync')
        .mockReturnValue(true);

      checkStartScript._checkAppConfig();

      expect(existSync).toHaveBeenCalledTimes(1);
      expect(existSync).toHaveBeenCalledWith(expect.stringContaining('appConfig.js'));
      expect(prints.appConfigMissing).not.toHaveBeenCalled();
      expect(exit).not.toHaveBeenCalled();

      existSync.mockRestore();
    });
  });

  describe('_checkPublicDirSync', () => {
    it('quit if copying file fails', () => {
      const err = new Error('asd');
      const copyFileSync = jest
        .spyOn(fs, 'copyFileSync')
        .mockImplementation(() => {
          throw err;
        });

      checkStartScript._checkPublicDirSync(true);

      expect(copyFileSync).toHaveBeenCalledTimes(1);
      expect(prints.publicDirCopyFailed).toHaveBeenCalledTimes(1);
      expect(prints.publicDirCopyFailed).toHaveBeenCalledWith(err, true);
      expect(exit).toHaveBeenCalledTimes(1);
      expect(exit).toHaveBeenCalledWith(1);

      copyFileSync.mockRestore();
    });

    it('not quit if copying file pass', () => {
      const copyFileSync = jest
        .spyOn(fs, 'copyFileSync')
        .mockReturnValue(undefined);

      checkStartScript._checkPublicDirSync(true);

      expect(copyFileSync).toHaveBeenCalledTimes(1);
      expect(prints.publicDirCopyFailed).not.toHaveBeenCalled();
      expect(exit).not.toHaveBeenCalled();

      copyFileSync.mockRestore();
    });
  });

  describe('_verifyPackageVersion', () => {
    it('should quit if expected dependency is not found', () => {
      const pkg = {
        version: '1.18.0',
        dependencies: {},
      };
      checkStartScript._verifyPackageVersion(pkg, false, false, 'foo');

      expect(prints.expectedDependencyNotFound).toHaveBeenCalledTimes(1);
      expect(prints.expectedDependencyNotFound).toHaveBeenCalledWith('foo');
      expect(exit).toHaveBeenCalledTimes(1);
      expect(exit).toHaveBeenCalledWith(1);
    });

    it('should warn about version mismatch and quit', () => {
      const pkg = {
        version: '1.18.0',
        dependencies: { lerna: '10.0.0' },
      };
      checkStartScript._verifyPackageVersion(pkg, false, false, 'lerna');

      expect(prints.versionMismatch).toHaveBeenCalledTimes(1);
      expect(prints.versionMismatch).toHaveBeenCalledWith('lerna', lernaVersion, '10.0.0', false);
      expect(exit).toHaveBeenCalledTimes(1);
      expect(exit).toHaveBeenCalledWith(1);
    });

    it('should warn about version mismatch but not quit', () => {
      const pkg = {
        version: '1.18.0',
        dependencies: { lerna: '10.0.0' },
      };
      checkStartScript._verifyPackageVersion(pkg, true, false, 'lerna');

      expect(prints.versionMismatch).toHaveBeenCalledTimes(1);
      expect(prints.versionMismatch).toHaveBeenCalledWith('lerna', lernaVersion, '10.0.0', true);
      expect(exit).not.toHaveBeenCalled();
    });

    it('should find no conflict with pinned dependency', () => {
      const pkg = {
        version: '1.18.0',
        dependencies: { lerna: lernaVersion },
      };
      checkStartScript._verifyPackageVersion(pkg, false, false, 'lerna');

      expect(exit).not.toHaveBeenCalled();
    });

    it('should find no conflict with unpinned dependency', () => {
      const pkg = {
        version: '1.18.0',
        dependencies: { lerna: `^${lernaVersion}` },
      };
      checkStartScript._verifyPackageVersion(pkg, false, false, 'lerna');

      expect(exit).not.toHaveBeenCalled();
    });

    it('should warn if allowReact but unsupported flex-ui', () => {
      const pkg = {
        version: '1.18.0',
        dependencies: { lerna: `10.0.0` },
      };
      checkStartScript._verifyPackageVersion(pkg, false, true, 'lerna');

      expect(prints.unbundledReactMismatch).toHaveBeenCalledTimes(1);
      expect(prints.unbundledReactMismatch).toHaveBeenCalledWith('1.18.0', 'lerna', lernaVersion, false);
      expect(prints.versionMismatch).not.toHaveBeenCalled();
      expect(exit).toHaveBeenCalled();
    });

    it('should warn if allowReact', () => {
      const pkg = {
        version: '1.19.0',
        dependencies: { lerna: `10.0.0` },
      };
      checkStartScript._verifyPackageVersion(pkg, false, true, 'lerna');

      expect(prints.unbundledReactMismatch).not.toHaveBeenCalled();
      expect(prints.versionMismatch).not.toHaveBeenCalled();
      expect(exit).not.toHaveBeenCalled();
    });
  });

  describe('_checkPluginCount', () => {
    const _readIndexPage = jest
      .spyOn(checkStartScript, '_readIndexPage');

    beforeEach(() => {
      _readIndexPage.mockReset();
    });

    afterAll(() => {
      _readIndexPage.mockRestore();
    });

    it('should check with no error', () => {
      _readIndexPage.mockReturnValue('blahblah\nFlexPlugin.loadPlugin\nblahblah');
      checkStartScript._checkPluginCount();

      expect(_readIndexPage).toHaveBeenCalledTimes(1);
      expect(exit).not.toHaveBeenCalled();
      expect(prints.loadPluginCountError).not.toHaveBeenCalled();
    });

    it('should warn no loadPlugin was called', () => {
      _readIndexPage.mockReturnValue('blahblah');
      checkStartScript._checkPluginCount();

      expect(_readIndexPage).toHaveBeenCalledTimes(1);
      expect(exit).toHaveBeenCalledTimes(1);
      expect(exit).toHaveBeenCalledWith(1);
      expect(prints.loadPluginCountError).toHaveBeenCalledTimes(1);
      expect(prints.loadPluginCountError).toHaveBeenCalledWith(0);
    });

    it('should warn that multiple loadPlugins were called', () => {
      _readIndexPage.mockReturnValue('blahblah\nloadPlugin\nloadPlugin\nloadPlugin\nblahblah');
      checkStartScript._checkPluginCount();

      expect(_readIndexPage).toHaveBeenCalledTimes(1);
      expect(exit).toHaveBeenCalledTimes(1);
      expect(exit).toHaveBeenCalledWith(1);
      expect(prints.loadPluginCountError).toHaveBeenCalledTimes(1);
      expect(prints.loadPluginCountError).toHaveBeenCalledWith(3);
    });
  });

  describe('_validateTypescriptProject', () => {
    const _hasTypescriptFiles = jest
      .spyOn(checkStartScript, '_hasTypescriptFiles')
      .mockReturnThis();
    const resolveModulePath = jest
      .spyOn(requireScripts, 'resolveModulePath')
      .mockReturnThis();
    const checkFilesExist = jest
      .spyOn(fsScripts, 'checkFilesExist')
      .mockReturnThis();
    const copyFileSync = jest
      .spyOn(fs, 'copyFileSync')
      .mockReturnValue(undefined);

    beforeEach(() => {
      _hasTypescriptFiles.mockReset();
      resolveModulePath.mockReset();
      checkFilesExist.mockReset();
      copyFileSync.mockReset();
    });

    afterAll(() => {
      _hasTypescriptFiles.mockRestore();
      resolveModulePath.mockRestore();
      checkFilesExist.mockRestore();
      copyFileSync.mockRestore();
    });

    it('should not do anything if not a typescript project', () => {
      _hasTypescriptFiles.mockReturnValue(false);

      checkStartScript._validateTypescriptProject();

      expect(_hasTypescriptFiles).toHaveBeenCalledTimes(1);
      expect(resolveModulePath).not.toHaveBeenCalled();
      expect(exit).not.toHaveBeenCalled();
    });

    it('should fail if typescript project and typescript module not installed', () => {
      _hasTypescriptFiles.mockReturnValue(true);
      resolveModulePath.mockReturnValue(false);

      checkStartScript._validateTypescriptProject();

      expect(_hasTypescriptFiles).toHaveBeenCalledTimes(1);
      expect(resolveModulePath).toHaveBeenCalledTimes(1);
      expect(resolveModulePath).toHaveBeenCalledWith('typescript');
      expect(exit).toHaveBeenCalledTimes(1);
      expect(exit).toHaveBeenCalledWith(1);
      expect(prints.typescriptNotInstalled).toHaveBeenCalledTimes(1);
      expect(checkFilesExist).not.toHaveBeenCalled();
    });

    it('should continue if typescript project and has tsconfig', () => {
      _hasTypescriptFiles.mockReturnValue(true);
      resolveModulePath.mockReturnValue('some-path');
      checkFilesExist.mockReturnValue(true);

      checkStartScript._validateTypescriptProject();

      expect(_hasTypescriptFiles).toHaveBeenCalledTimes(1);
      expect(resolveModulePath).toHaveBeenCalledTimes(1);
      expect(resolveModulePath).toHaveBeenCalledWith('typescript');
      expect(checkFilesExist).toHaveBeenCalledTimes(1);

      expect(copyFileSync).not.toHaveBeenCalled();
      expect(exit).not.toHaveBeenCalled();
      expect(prints.typescriptNotInstalled).not.toHaveBeenCalled();
    });

    it('should create default tsconfig.json', () => {
      _hasTypescriptFiles.mockReturnValue(true);
      resolveModulePath.mockReturnValue('some-path');
      checkFilesExist.mockReturnValue(false);
      const _copyFileSync = jest
        .spyOn(fs, 'copyFileSync')
        .mockReturnValue(undefined);

      checkStartScript._validateTypescriptProject();

      expect(_hasTypescriptFiles).toHaveBeenCalledTimes(1);
      expect(resolveModulePath).toHaveBeenCalledTimes(1);
      expect(resolveModulePath).toHaveBeenCalledWith('typescript');
      expect(checkFilesExist).toHaveBeenCalledTimes(1);
      expect(_copyFileSync).toHaveBeenCalledTimes(1);

      expect(exit).not.toHaveBeenCalled();
      expect(prints.typescriptNotInstalled).not.toHaveBeenCalled();
      _copyFileSync.mockRestore();
    });
  });


  
  describe('_checkPluginConfigurationExists', () => {
    it ('make directories if not found', () => {
      const checkFilesExist = jest
        .spyOn(fsScripts, 'checkFilesExist')
        .mockReturnValue(false);
      const mkdirpSync = jest
        .spyOn(fsScripts, 'mkdirpSync')
        .mockReturnValue('blah');
      
        checkStartScript._checkPluginConfigurationExists();

        expect(checkFilesExist).toHaveBeenCalledTimes(1);
        expect(checkFilesExist).toHaveBeenCalledWith('test-dir-plugins');
        expect(mkdirpSync).toHaveBeenCalledTimes(1);
        expect(mkdirpSync).toHaveBeenCalledWith('test-dir-flex');
      
        checkFilesExist.mockRestore();
        mkdirpSync.mockRestore();
    });

    it ('do nothing if directories are found', () => {
      const checkFilesExist = jest
        .spyOn(fsScripts, 'checkFilesExist')
        .mockReturnValue(true);
      const mkdirpSync = jest
        .spyOn(fsScripts, 'mkdirpSync')
        .mockReturnValue('test');
      
        checkStartScript._checkPluginConfigurationExists();

        expect(checkFilesExist).toHaveBeenCalledTimes(1);
        expect(checkFilesExist).toHaveBeenCalledWith('test-dir-plugins');
        expect(mkdirpSync).not.toHaveBeenCalled();
      
        checkFilesExist.mockRestore();
        mkdirpSync.mockRestore();
    });
  

    it ('should add the plugin to plugins.json if not found', async() => {
      const checkFilesExist = jest
        .spyOn(fsScripts, 'checkFilesExist')
        .mockReturnValue(true);
      const readJsonFile = jest
        .spyOn(fsScripts, 'readJsonFile')
        .mockReturnValue({"plugins": []});
      const writeFileSync = jest
        .spyOn(fs ,'writeFileSync')
        .mockReturnThis();

      await checkStartScript._checkPluginConfigurationExists();

      expect(checkFilesExist).toHaveBeenCalledTimes(1);
      expect(readJsonFile).toHaveBeenCalledTimes(1);
      expect(writeFileSync).toHaveBeenCalledTimes(1);
      expect(writeFileSync).toHaveBeenCalledWith('test-dir-plugins', JSON.stringify({"plugins":[{name:"plugin-test",dir:"test-dir", port:0}]}, null, 2))
      
      writeFileSync.mockRestore();
    });

    
    it('do nothing if plugin has same directory as an existing one', async() => {
      const checkFilesExist = jest
        .spyOn(fsScripts, 'checkFilesExist')
        .mockReturnValue(true);
      const readJsonFile = jest
        .spyOn(fsScripts, 'readJsonFile')
        .mockReturnValue({"plugins": [{name: 'plugin-test', dir: 'test-dir', port: 0}]});
      const writeFileSync = jest
        .spyOn(fs ,'writeFileSync')
        .mockReturnThis();

      await checkStartScript._checkPluginConfigurationExists();

      expect(checkFilesExist).toHaveBeenCalledTimes(1);
      expect(readJsonFile).toHaveBeenCalledTimes(1);
      expect(writeFileSync).not.toHaveBeenCalled();

      writeFileSync.mockRestore();
    });

    it('change file path if user confirms', async() => {
      const checkFilesExist = jest
        .spyOn(fsScripts, 'checkFilesExist')
        .mockReturnValue(true);
      const readJsonFile = jest
        .spyOn(fsScripts, 'readJsonFile')
        .mockReturnValue({"plugins": [{name: 'plugin-test', dir: 'test-dirr', port: 0}]});
      const writeFileSync = jest
        .spyOn(fs ,'writeFileSync')
        .mockReturnThis();
      const confirm = jest
        .spyOn(inquirer, 'confirm')
        .mockResolvedValue(true);
        
      await checkStartScript._checkPluginConfigurationExists();

      expect(checkFilesExist).toHaveBeenCalledTimes(1);
      expect(readJsonFile).toHaveBeenCalledTimes(1);
      expect(confirm).toHaveBeenCalledTimes(1);
      expect(readJsonFile).toHaveBeenCalledTimes(1);
      expect(writeFileSync).toHaveBeenCalledTimes(1);
      expect(writeFileSync).toHaveBeenCalledWith('test-dir-plugins', JSON.stringify({"plugins":[{name:"plugin-test",dir:"test-dir", port:0}]}, null, 2));
    });

    it('do not change file path, user did not confirm', async() => {
      const checkFilesExist = jest
        .spyOn(fsScripts, 'checkFilesExist')
        .mockReturnValue(true);
      const readJsonFile = jest
        .spyOn(fsScripts, 'readJsonFile')
        .mockReturnValue({"plugins": [{name: 'plugin-test', dir: 'test-dirr', port: 0}]});
      const writeFileSync = jest
        .spyOn(fs ,'writeFileSync')
        .mockReturnThis();
      const confirm = jest
        .spyOn(inquirer, 'confirm')
        .mockResolvedValue(false);
        
      await checkStartScript._checkPluginConfigurationExists();

      expect(checkFilesExist).toHaveBeenCalledTimes(1);
      expect(readJsonFile).toHaveBeenCalledTimes(1);
      expect(confirm).toHaveBeenCalledTimes(1);
      expect(writeFileSync).not.toHaveBeenCalled();
    });
    
  });
});
