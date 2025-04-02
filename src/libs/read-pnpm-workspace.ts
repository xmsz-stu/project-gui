import { readFile, writeFile } from '@tauri-apps/plugin-fs';
import { parse, stringify } from 'yaml';

export default async function ReadPnpmWorkSpace({
  projectPath,
}: {
  projectPath: string;
}) {
  return parse(
    new TextDecoder().decode(
      await readFile(`${projectPath}/pnpm-workspace.yaml`)
    )
  ) as {
    'packages': string[];
    catalog: Record<string, string>;
  };
}

export async function writePnpmWorkSpace({
  projectPath,
  content,
}: {
  projectPath: string;
  content: object;
}) {
  return await writeFile(
    `${projectPath}/pnpm-workspace.yaml`,
    new TextEncoder().encode(stringify(content))
  );
}
