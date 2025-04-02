import { Store } from '@tanstack/react-store';

interface IState {
  projectPath: string;
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
}
export const store = new Store<IState>({
  projectPath: '/Users/kuban/code/cool-qi',
  packageAllFromPackageJson: {},
  duplicatePackageInDependencyTree: [],
  recommendUseCatalogs: [],
});

export const updatePackageAllFromPackageJson = ({
  packageJsonList,
}: {
  packageJsonList: {
    path: string;
    name: string;
    content: {
      dependencies: Record<string, string>;
      devDependencies?: Record<string, string>;
    };
  }[];
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
