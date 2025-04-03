import { store } from '../store';

import { useStore } from '@tanstack/react-store';
import { message } from '@tauri-apps/plugin-dialog';

import Section from './section';
import { useMemo, useState } from 'react';
import { Badge } from './ui/badge';

export default function DuplicateInPackageJson() {
  const packagesInfoList = useStore(store, (state) => state.packagesInfoList);
  const [ignorePackages] = useState([
    'clsx',
    'eventemitter2',
    'nanoid',
    'rimraf',
  ]);

  const data = useMemo(() => {
    console.log(300, packagesInfoList);
    return packagesInfoList.filter((n) => {
      const versions = Object.keys(n.versions);
      if (versions.length <= 1) return false;

      if (!store.state.packageAllFromPackageJson[n.name]) return false;

      if (ignorePackages.includes(n.name)) return false;

      return true;
    });
  }, [packagesInfoList]);
  console.log(400, data.length);

  return (
    <Section
      title={'packageJson里的重复包'}
      num={data.length}
      hasDone={!data.length}
    >
      <div className='flex items-center mt-1 mb-3'>
        忽略：
        {ignorePackages.map((i) => (
          <Badge variant='outline' key={i} className='mr-2'>
            {i}
          </Badge>
        ))}
      </div>
      {!!data.length && (
        <div className='max-h-100 overflow-auto bg-gray-100 p-4 rounded-xl mt-1'>
          {data.map((i) => (
            <article
              key={i.name}
              className='flex items-center justify-between py-1'
            >
              <div>
                <span
                  className='block'
                  onClick={() => {
                    message(JSON.stringify(i.versions, null, 2), {
                      title: i.name,
                      kind: 'info',
                    });
                  }}
                >
                  {i.name}
                </span>
                <span className='text-xs text-gray-600 mt-2 leading-4'>
                  {Object.keys(i.versions).join('、')}
                </span>
              </div>
            </article>
          ))}
        </div>
      )}
    </Section>
  );
}
