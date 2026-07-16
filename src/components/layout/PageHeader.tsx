import { ReactNode } from "react";

export const PageHeader = ({ title, description, actions }: { title: string; description?: string; actions?: ReactNode }) => (
  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
    <div>
      <h1 className="font-display text-3xl md:text-4xl font-bold text-foreground">{title}</h1>
      {description && <p className="text-muted-foreground mt-1">{description}</p>}
    </div>
    {actions && <div className="flex items-center gap-2">{actions}</div>}
  </div>
);
