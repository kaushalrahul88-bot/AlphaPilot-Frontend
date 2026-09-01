import type { ReactNode } from 'react';

export function Card({ children, className = '', onClick }: { children: ReactNode; className?: string; onClick?: () => void }) {
  return (
    <div
      onClick={onClick}
      className={`bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl ${onClick ? 'cursor-pointer hover:border-slate-300 dark:hover:border-slate-700 transition-colors' : ''} ${className}`}
    >
      {children}
    </div>
  );
}

export function CardHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-slate-100 dark:border-slate-800">
      <div>
        <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">{title}</h3>
        {subtitle && <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function CardBody({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`px-5 py-4 ${className}`}>{children}</div>;
}

export function StatCard({ label, value, subvalue, icon, accent = 'default' }: {
  label: string; value: string; subvalue?: string; icon?: ReactNode;
  accent?: 'default' | 'green' | 'red' | 'blue' | 'amber';
}) {
  const accentColors: Record<string, string> = {
    default: 'text-slate-900 dark:text-white',
    green: 'text-emerald-600 dark:text-emerald-400',
    red: 'text-red-600 dark:text-red-400',
    blue: 'text-blue-600 dark:text-blue-400',
    amber: 'text-amber-600 dark:text-amber-400',
  };
  return (
    <Card className="p-4">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">{label}</p>
          <p className={`text-xl font-bold mt-1 ${accentColors[accent]}`}>{value}</p>
          {subvalue && <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{subvalue}</p>}
        </div>
        {icon && <div className="text-slate-400 dark:text-slate-500">{icon}</div>}
      </div>
    </Card>
  );
}

export function Badge({ children, variant = 'default' }: { children: ReactNode; variant?: 'default' | 'green' | 'red' | 'blue' | 'amber' | 'purple' }) {
  const variants: Record<string, string> = {
    default: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
    green: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
    red: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    blue: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    amber: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
    purple: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  };
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium ${variants[variant]}`}>{children}</span>;
}

export function Button({ children, onClick, variant = 'default', size = 'md', className = '', type = 'button', disabled = false }: {
  children: ReactNode; onClick?: () => void; variant?: 'default' | 'primary' | 'danger' | 'ghost'; size?: 'sm' | 'md' | 'lg'; className?: string; type?: 'button' | 'submit'; disabled?: boolean;
}) {
  const variants: Record<string, string> = {
    default: 'bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-200',
    primary: 'bg-blue-600 hover:bg-blue-700 text-white',
    danger: 'bg-red-600 hover:bg-red-700 text-white',
    ghost: 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300',
  };
  const sizes: Record<string, string> = {
    sm: 'px-2.5 py-1 text-xs',
    md: 'px-4 py-2 text-sm',
    lg: 'px-6 py-2.5 text-base',
  };
  return (
    <button type={type} onClick={onClick} disabled={disabled} className={`rounded-lg font-medium transition-colors ${variants[variant]} ${sizes[size]} ${className} ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}>
      {children}
    </button>
  );
}

export function Input({ label, value, onChange, type = 'text', placeholder, step, min, className = '' }: {
  label?: string; value: string | number; onChange: (v: string) => void; type?: string; placeholder?: string; step?: string; min?: string; className?: string;
}) {
  return (
    <div className={className}>
      {label && <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">{label}</label>}
      <input
        type={type}
        value={value}
        step={step}
        min={min}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
    </div>
  );
}

export function Select({ label, value, onChange, options, className = '' }: {
  label?: string; value: string; onChange: (v: string) => void; options: { value: string; label: string }[]; className?: string;
}) {
  return (
    <div className={className}>
      {label && <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">{label}</label>}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
}

export function Modal({ open, onClose, title, children, maxWidth = 'max-w-lg' }: {
  open: boolean; onClose: () => void; title: string; children: ReactNode; maxWidth?: string;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={onClose}>
      <div className={`w-full ${maxWidth} max-h-[90vh] overflow-y-auto bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xl`} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-800 sticky top-0 bg-white dark:bg-slate-900 z-10">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">{title}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-xl">×</button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

export function Table({ headers, children }: { headers: string[]; children: ReactNode }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-200 dark:border-slate-800">
            {headers.map((h, i) => (
              <th key={i} className="text-left px-3 py-2 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide whitespace-nowrap">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

export function TableRow({ children, onClick }: { children: ReactNode; onClick?: () => void }) {
  return (
    <tr onClick={onClick} className={`border-b border-slate-100 dark:border-slate-800/50 ${onClick ? 'cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50' : ''}`}>
      {children}
    </tr>
  );
}

export function TableCell({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <td className={`px-3 py-2.5 text-slate-700 dark:text-slate-300 whitespace-nowrap ${className}`}>{children}</td>;
}
