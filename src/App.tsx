import { useEffect, useMemo, useState } from 'react';
import './App.css';
import UpdateToCatalogs from './components/update-to-catalogs';
import {
  store,
  updateDuplicatePackageInDependencyTree,
  updatePackageAllFromPackageJson,
  updatePackagesInfoList,
  updateRecommendUseCatalogs,
  init,
  reload,
} from './store';
import { useStore } from '@tanstack/react-store';
import Section from './components/section';
import DuplicateInPackageJson from './components/duplicate-in-package-json';
import { Button } from './components/ui/button';
import { RefreshCcw } from 'lucide-react';

function App() {
  const projectPath = useStore(store, (state) => state.projectPath);
  useEffect(() => {
    init({ projectPath: '/Users/kuban/code/cool-qi' });
  }, []);

  const lockContent = useStore(store, (state) => state.lockContent);
  useEffect(() => {
    updatePackagesInfoList({ lockContent });
  }, [lockContent]);
  const [packageName] = useState('@alifd/next');
  const packagesInfoList = useStore(store, (state) => state.packagesInfoList);
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

  // STEP: 所有子目录下的package.json
  const packageJsonList = useStore(store, (state) => state.packageJsonList);

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
      <header className='flex items-center justify-between px-4 py-2'>
        项目地址：{projectPath}
        <Button variant='secondary' onClick={reload}>
          <RefreshCcw />
        </Button>
      </header>
      <Section
        list={duplicatePackageInDependencyTree}
        hasDone={!duplicatePackageInDependencyTree.length}
        title={'依赖树里重复的'}
      />
      <UpdateToCatalogs />
      <DuplicateInPackageJson />
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
