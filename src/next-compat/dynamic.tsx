import React, { Suspense } from "react";

type Loader<T> = () => Promise<{ default: React.ComponentType<T> }>;

type DynamicOptions<T> = {
  ssr?: boolean;
  loading?: () => React.ReactNode;
};

export default function dynamic<T extends Record<string, unknown>>(
  loader: Loader<T>,
  options?: DynamicOptions<T>
) {
  const Lazy = React.lazy(loader);
  return function DynamicComponent(props: T) {
    const fallback = options?.loading ? options.loading() : null;
    return (
      <Suspense fallback={fallback}>
        <Lazy {...props} />
      </Suspense>
    );
  };
}
