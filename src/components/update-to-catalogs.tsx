import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { store, updatePackageJsonList } from '../store';
import { Command } from '@tauri-apps/plugin-shell';
import ReadPnpmWorkSpace, {
  writePnpmWorkSpace,
} from '../libs/read-pnpm-workspace';
import { useStore } from '@tanstack/react-store';
import { message } from '@tauri-apps/plugin-dialog';
import { Button } from './ui/button';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import Section from './section';

const executeCommand = async (cmd: string, args: string[]) => {
  const command = await Command.create(cmd, args);

  command.on('close', (data) => {
    console.log('command finished with code:', data.code);
  });
  command.on('error', (error) => {
    console.error('command error:', error);
  });

  command.stdout.on('data', (line) => {
    console.log('stdout:', line);
  });

  command.stderr.on('data', (line) => {
    console.log('stderr:', line);
  });

  try {
    const output = await command.execute();
    // console.log('Command output:', output);
    return output;
  } catch (error) {
    console.error('Failed to execute command:', error);
    throw error;
  }
};

export default function UpdateToCatalogs() {
  const recommendUseCatalogs = useStore(
    store,
    (state) => state.recommendUseCatalogs
  );

  const { mutateAsync, isPending, variables } = useMutation({
    mutationFn: async ({ packageName }: { packageName: string }) => {
      const { projectPath } = store.state;
      const { versions } = store.state.packageAllFromPackageJson[packageName];
      const firstKey = Object.keys(versions)[0];
      const packageList = versions[firstKey];

      // STEP: 添加workspace.yaml
      const pnpmSpace = await ReadPnpmWorkSpace({ projectPath });
      pnpmSpace.catalog[packageName] = firstKey;
      await writePnpmWorkSpace({ projectPath, content: pnpmSpace });

      // STEP: 获取需要升级的项目目录
      // CANDO: 暂时是单个版本

      // console.log(Object.values(versions)[0]);
      const args = [
        '-C',
        store.state.projectPath,
        ...packageList.flatMap((name) => ['--filter', name]),
        'add',
        `${packageName}@catalog:`,
        '-D',
      ];
      const res = await executeCommand('pnpm', args);
      console.log(res, res.stdout, args);

      // STEP: 更新推荐使用的
      await updatePackageJsonList({ projectPath });
    },
    onError: console.error,
    onSuccess(_, variables) {
      toast.success(`更新成功: ${variables.packageName}`);
    },
  });

  return (
    <Section
      title={'推荐使用catalogs'}
      num={recommendUseCatalogs.length}
      hasDone={!recommendUseCatalogs.length}
    >
      {!!recommendUseCatalogs.length && (
        <div className='max-h-100 overflow-auto bg-gray-100 p-4 rounded-xl mt-1'>
          {recommendUseCatalogs.map((i) => (
            <article key={i} className='flex items-center justify-between py-1'>
              <span
                onClick={() => {
                  message(
                    Object.values(
                      store.state.packageAllFromPackageJson[i].versions
                    ).join('\n'),
                    {
                      title: i,
                      kind: 'info',
                    }
                  );
                }}
              >
                {i}
              </span>
              <Button
                disabled={isPending}
                onClick={() => {
                  mutateAsync({ packageName: i });
                }}
                variant='outline'
              >
                {isPending && variables.packageName === i && (
                  <Loader2 className=' animate-spin' />
                )}
                使用{i}
                {isPending && variables.packageName === i ? '中' : ''}
              </Button>
            </article>
          ))}
          {/* <select
        name='选择器名称'
        value={packageName}
        onChange={(e) => {
          setPackageName(e.target.value);
        }}
      >
        {recommendUseCatalogs.map((i) => {
          return <option value={i}>{i}</option>;
        })}
      </select>
    */}
        </div>
      )}
    </Section>
  );
}
