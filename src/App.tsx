import { ReactNode, useEffect, useMemo, useState } from 'react';
import { readDir, readFile } from '@tauri-apps/plugin-fs';
import './App.css';
import { parse } from 'yaml';
import UpdateToCatalogs from './components/update-to-catalogs';
import {
  store,
  updateDuplicatePackageInDependencyTree,
  updatePackageAllFromPackageJson,
  updateRecommendUseCatalogs,
} from './store';
import { useStore } from '@tanstack/react-store';
import ReadPnpmWorkSpace from './libs/read-pnpm-workspace';

const Section = ({
  title,
  children,
  list,
  object,
}: {
  title: ReactNode;
  children?: ReactNode;
  list?: any[];
  object?: object;
}) => {
  const hasDone = list !== undefined && list?.length === 0;
  return (
    <section className='border-b border-gray-200 p-2'>
      <b className='block'>
        {list ? (
          <>
            {hasDone && '✅'}
            {title}
            {hasDone ? '' : `(${list.length})`}
          </>
        ) : (
          title
        )}
      </b>
      {!hasDone && (
        <details>
          <pre className='max-h-100 overflow-auto bg-gray-50'>
            {list ? (
              JSON.stringify(list, null, 2)
            ) : (
              <>{object ? JSON.stringify(object, null, 2) : null}</>
            )}
          </pre>
        </details>
      )}
      {children}
    </section>
  );
};

function App() {
  const projectPath = useStore(store, (state) => state.projectPath);
  const [lockContent, setLockContent] = useState<
    | {
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
      }
    | undefined
  >(undefined);
  const packagesInfoList = useMemo(() => {
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
        const prevIndex = res.findIndex((n) => n.name === curKey);
        // console.log(prevIndex);
        if (prevIndex === -1) {
          // CANDO: 空的 -> 也提示用户，可能是残留的
          res.push({
            name: curKey,
            versions: { [curValue]: { fromDependencies: [key] } },
          });
        } else {
          // CONDI: 已有
          if (res[prevIndex].versions[curValue]) {
            res[prevIndex].versions[curValue].fromDependencies.push(key);
          } else {
            res[prevIndex].versions[curValue] = { fromDependencies: [key] };
          }
        }
      });
    });

    return res;
  }, [lockContent]);
  const [packageName] = useState('@alifd/next');
  const [packageInfoList] = useMemo(
    () =>
      packagesInfoList.filter(({ name }) => {
        return name.startsWith(packageName);
      }),
    [packagesInfoList, packageName]
  );

  const duplicatePackageList = useMemo(() => {
    return packagesInfoList.filter((n) => Object.keys(n.versions).length > 1);
  }, [packagesInfoList]);

  useEffect(() => {
    // STEP: 获取lock内容
    readFile(`${projectPath}/pnpm-lock.yaml`)
      .then((res) => setLockContent(parse(new TextDecoder().decode(res))))
      .catch(console.error);
  }, []);

  // STEP: 所有子目录下的package.json
  const [packageJsonList, setPackageJsonList] = useState<
    Array<{
      path: string;
      name: string;
      content: {
        dependencies: Record<string, string>;
        devDependencies?: Record<string, string>;
      };
    }>
  >([]);
  useEffect(() => {
    ReadPnpmWorkSpace({ projectPath })
      .then((workspace) => {
        // 获取所有工作区目录
        const workspaceDirs = workspace.packages.map(
          (pkg: string) => pkg.replace('*', '') // 处理 'packages/*' 这样的模式
        ) as string[];

        // 对每个工作区目录进行查找
        return Promise.all(
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
          .then((results) => results.flat().filter(Boolean))
          .then((res) => {
            setPackageJsonList(res as Array<NonNullable<(typeof res)[number]>>);
          });
      })
      .catch((error) => {
        console.error('Error reading workspace config:', error);
        return [];
      });
  }, [projectPath]);

  // STEP: 项目中依赖已经对应项目
  useEffect(() => {
    updatePackageAllFromPackageJson({ packageJsonList });
  }, [packageJsonList]);

  const packageAllFromPackageJson = useStore(
    store,
    (state) => state.packageAllFromPackageJson
  );
  const duplicatePackageInDependencyTree = useStore(
    store,
    (state) => state.duplicatePackageInDependencyTree
  );

  useEffect(() => {
    updateDuplicatePackageInDependencyTree({ packageAllFromPackageJson });
  }, [packageAllFromPackageJson]);

  useEffect(() => {
    updateRecommendUseCatalogs({ packageAllFromPackageJson });
  }, [packageAllFromPackageJson]);

  const recommendUseCatalogs = useStore(
    store,
    (state) => state.recommendUseCatalogs
  );

  return (
    <div>
      项目地址：{projectPath}
      <Section
        list={duplicatePackageInDependencyTree}
        title={'依赖树里重复的'}
      />
      <Section title={'推荐使用catalogs'} list={recommendUseCatalogs}>
        <UpdateToCatalogs />
      </Section>
      <Section title={'依赖信息树'} object={packageAllFromPackageJson} />
      {/* 配置内容:
      <pre className='h-100 overflow-auto'>
        {JSON.stringify(lockContent, null, 2)}
      </pre> */}
      <br />
      {/* 依赖信息
      <pre className='h-100 overflow-auto'>
        {JSON.stringify(packageJsonList, null, 2)}
      </pre> */}
      --- ---
      {packageName}内容
      <pre>{JSON.stringify(packageInfoList, null, 2)}</pre>
      重复的包({duplicatePackageList.length})
      <pre className='h-100 overflow-auto'>
        {JSON.stringify(duplicatePackageList, null, 2)}
      </pre>
      <div>
        推荐
        <div>1. 依赖树有重复包，统一版本</div>
        <div>2. 依赖树推荐使用catalogs代替</div>
        <div>3. pnpm prune</div>
        <div>4. pnpm dedupe</div>
      </div>
    </div>
  );
}

export default App;
