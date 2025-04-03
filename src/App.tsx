import { ReactNode, useEffect, useMemo, useState } from 'react';
import { readDir, readFile } from '@tauri-apps/plugin-fs';
import './App.css';
import { parse } from 'yaml';
import UpdateToCatalogs from './components/update-to-catalogs';
import {
  store,
  updateDuplicatePackageInDependencyTree,
  updatePackageAllFromPackageJson,
  updatePackageJsonList,
  updateRecommendUseCatalogs,
} from './store';
import { useStore } from '@tanstack/react-store';
import Section from './components/section';

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
  const packageJsonList = useStore(store, (state) => state.packageJsonList);
  useEffect(() => {
    updatePackageJsonList({ projectPath });
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

  return (
    <div>
      项目地址：{projectPath}
      <Section
        list={duplicatePackageInDependencyTree}
        hasDone={!duplicatePackageInDependencyTree.length}
        title={'依赖树里重复的'}
      />
      <UpdateToCatalogs />
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
