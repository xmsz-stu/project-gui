import { ReactNode } from 'react';

const Section = ({
  title,
  children,
  list,
  object,
  hasDone,
  num,
}: {
  title: ReactNode;
  children?: ReactNode;
  list?: any[];
  object?: object;
  hasDone?: boolean;
  num?: number;
}) => {
  return (
    <section className='border-b border-gray-200 p-2'>
      <b className='flex items-center py-1'>
        {hasDone && '✅'}
        {title}
        {hasDone || !num ? (
          ''
        ) : (
          <span className=' w-5 h-5 rounded-full bg-gray-100 text-gray-700 font-semibold block ml-2 text-xs text-center leading-5'>
            {list?.length || num}
          </span>
        )}
      </b>
      {!hasDone && (list || object) && (
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

export default Section;
