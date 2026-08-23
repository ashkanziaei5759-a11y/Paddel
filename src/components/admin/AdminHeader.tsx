export function AdminHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  return (
    <header className="sticky top-0 z-30 border-b border-brand-100/70 bg-surface-muted/85 backdrop-blur-xl safe-top">
      <div className="flex items-center justify-between gap-3 px-4 py-4 sm:px-6 lg:px-8">
        <div className="min-w-0">
          <h1 className="truncate text-lg font-black text-brand-800">{title}</h1>
          {subtitle && (
            <p className="mt-0.5 truncate text-[11px] font-semibold text-brand-400">{subtitle}</p>
          )}
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
    </header>
  );
}
