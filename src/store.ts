import { Store } from '@tanstack/react-store';
import ReadPnpmWorkSpace from './libs/read-pnpm-workspace';
import { readDir, readFile } from '@tauri-apps/plugin-fs';
import { parse } from 'yaml';

interface IState {
  /** 项目路径 */
  projectPath: string;
  /** 子项目的依赖信息 */
  packageJsonList: {
    path: string;
    name: string;
    content: {
      dependencies: Record<string, string>;
      devDependencies?: Record<string, string>;
    };
  }[];

  packageAllFromPackageJson: {
    [key: string]: {
      versions: {
        [version: string]: string[];
      };
    };
  };
  duplicatePackageInDependencyTree: [
    string,
    {
      versions: {
        [version: string]: string[];
      };
    }
  ][];
  recommendUseCatalogs: string[];
  packagesInfoList: {
    name: string;
    versions: Record<
      string,
      {
        fromDependencies: string[];
      }
    >;
  }[];
  lockContent?: {
    'lockfileVersion': '9.0';
    'settings': {
      'autoInstallPeers': true;
      'excludeLinksFromLockfile': false;
    };
    packages: Record<string, {}>;
    snapshots: Record<
      string,
      {
        'dependencies'?: Record<string, string>;
      }
    >;
  };
}
export const store = new Store<IState>({
  projectPath: '',
  packageJsonList: [],
  packageAllFromPackageJson: {},
  duplicatePackageInDependencyTree: [],
  recommendUseCatalogs: [],
  packagesInfoList: [],
  lockContent: undefined,
});

export const init = async ({
  projectPath,
}: {
  projectPath: IState['projectPath'];
}) => {
  store.setState((prev) => ({
    ...prev,
    projectPath,
  }));

  updateLockContent({ projectPath });
  updatePackageJsonList({ projectPath });
};

export const reload = async () => {
  return await init({ projectPath: store.state.projectPath });
};

export const updatePackageJsonList = async ({
  projectPath,
}: {
  projectPath: IState['projectPath'];
}) => {
  const workspace = await ReadPnpmWorkSpace({ projectPath });
  // 获取所有工作区目录
  const workspaceDirs = workspace.packages.map(
    (pkg: string) => pkg.replace('*', '') // 处理 'packages/*' 这样的模式
  ) as string[];

  // 对每个工作区目录进行查找
  const res = (
    await Promise.all(
      workspaceDirs.map(async (dir) => {
        const fullPath = `${projectPath}/${dir}`;
        // 只读取直接子目录
        const subDirs = await readDir(fullPath);
        return Promise.all(
          subDirs.map(async (file) => {
            const packageJsonPath = `${fullPath}${file.name}/package.json`;
            try {
              const content = JSON.parse(
                new TextDecoder().decode(await readFile(packageJsonPath))
              );

              return {
                path: packageJsonPath,
                name: content.name,
                content,
              };
            } catch (error) {
              // 如果文件不存在或读取失败，返回 null
              return null;
            }
          })
        );
      })
    )
  )
    .flat()
    .filter(Boolean);

  store.setState((prev) => ({
    ...prev,
    packageJsonList: res as IState['packageJsonList'],
  }));
};

const updateLockContent = async ({ projectPath }: { projectPath: string }) => {
  // STEP: 获取lock内容
  const res = parse(
    new TextDecoder().decode(await readFile(`${projectPath}/pnpm-lock.yaml`))
  );
  store.setState((prev) => ({ ...prev, lockContent: res }));
};

export const updatePackagesInfoList = async ({
  lockContent,
}: {
  lockContent: IState['lockContent'];
}) => {
  const res = Object.entries(lockContent?.packages || {}).reduce<
    Array<{
      name: string;
      versions: Record<
        string,
        {
          fromDependencies: string[];
        }
      >;
    }>
  >((prev, [key]) => {
    const lastAtIdx = key.lastIndexOf('@');
    const name = key.slice(0, lastAtIdx);
    const version = key.slice(lastAtIdx + 1);

    const prevIndex = prev.findIndex((n) => n.name === name);
    if (prevIndex !== -1) {
      prev[prevIndex].versions[version] = {
        fromDependencies: [],
      };
    } else {
      prev.push({ name, versions: { [version]: { fromDependencies: [] } } });
    }

    // STEP: 检查deps

    return prev;
  }, []);

  // STEP: 补全fromDepends
  Object.entries(lockContent?.snapshots || {}).forEach(([key, value]) => {
    Object.entries(value.dependencies || {}).forEach(([curKey, curValue]) => {
      const curName = curKey;
      const curVersion = curValue.split('(')[0];

      const prevIndex = res.findIndex((n) => n.name === curName);
      // console.log(prevIndex);
      if (prevIndex === -1) {
        // CANDO: 空的 -> 也提示用户，可能是残留的
        res.push({
          name: curName,
          versions: { [curVersion]: { fromDependencies: [key] } },
        });
      } else {
        // CONDI: 已有
        if (res[prevIndex].versions[curVersion]) {
          res[prevIndex].versions[curVersion].fromDependencies.push(key);
        } else {
          res[prevIndex].versions[curVersion] = { fromDependencies: [key] };
        }
      }
    });
  });

  store.setState((prev) => ({ ...prev, packagesInfoList: res }));
};

export const updatePackageAllFromPackageJson = ({
  packageJsonList,
}: {
  packageJsonList: IState['packageJsonList'];
}) => {
  const result: {
    [key: string]: {
      versions: {
        [version: string]: string[];
      };
    };
  } = {};

  packageJsonList.forEach((pkg) => {
    // 处理 dependencies
    Object.entries(pkg.content.dependencies || {}).forEach(
      ([name, version]) => {
        if (!result[name]) {
          result[name] = { versions: {} };
        }
        if (!result[name].versions[version as string]) {
          result[name].versions[version as string] = [];
        }
        result[name].versions[version as string].push(pkg.name);
      }
    );

    // 处理 devDependencies
    Object.entries(pkg.content.devDependencies || {}).forEach(
      ([name, version]) => {
        if (!result[name]) {
          result[name] = { versions: {} };
        }
        if (!result[name].versions[version as string]) {
          result[name].versions[version as string] = [];
        }
        result[name].versions[version as string].push(pkg.name);
      }
    );
  });

  store.setState((prev) => ({ ...prev, packageAllFromPackageJson: result }));
};

// STEP: 找到依赖树里有没有多版本
export const updateDuplicatePackageInDependencyTree = ({
  packageAllFromPackageJson,
}: {
  packageAllFromPackageJson: IState['packageAllFromPackageJson'];
}) => {
  const result = Object.entries(packageAllFromPackageJson).filter(
    ([_, value]) => {
      return Object.keys(value.versions).length > 1;
    }
  );
  store.setState((prev) => ({
    ...prev,
    duplicatePackageInDependencyTree: result,
  }));
};
// STEP: 推荐使用catalogs的
export const updateRecommendUseCatalogs = ({
  packageAllFromPackageJson,
}: {
  packageAllFromPackageJson: IState['packageAllFromPackageJson'];
}) => {
  const res = Object.entries(packageAllFromPackageJson)
    .filter(([_, value]) => {
      const firstKey = Object.keys(value.versions)[0];
      return (
        Object.keys(value.versions).length === 1 &&
        firstKey !== 'catalog:' &&
        !firstKey.startsWith('workspace:') &&
        value.versions[firstKey].length > 1
      );
    })
    .map((i) => i[0]);

  store.setState((prev) => ({
    ...prev,
    recommendUseCatalogs: res,
  }));
};
