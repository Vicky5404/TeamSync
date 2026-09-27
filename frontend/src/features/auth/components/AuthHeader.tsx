import type { ReactNode } from 'react';

interface AuthHeaderProps {
  title: string;
  description?: ReactNode;
  icon?: ReactNode;
}

export function AuthHeader({ title, description, icon }: AuthHeaderProps) {
  return (
    <div className="space-y-2">
      {icon && (
        <div
          aria-hidden="true"
          className="mb-4 flex size-11 items-center justify-center rounded-full bg-primary-soft text-primary-soft-foreground [&_svg]:size-5"
        >
          {icon}
        </div>
      )}
      <h1 className="text-2xl font-semibold tracking-tight text-foreground">{title}</h1>
      {description && <p className="text-sm text-muted-foreground">{description}</p>}
    </div>
  );
}
