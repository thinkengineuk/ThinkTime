import { Badge } from "@/components/ui/badge";

const statusConfig = {
  open: { label: "Open", className: "bg-emerald-500/10 text-emerald-600 border-emerald-200" },
  pending: { label: "Pending", className: "bg-amber-500/10 text-amber-600 border-amber-200" },
  resolved: { label: "Resolved", className: "bg-blue-500/10 text-blue-600 border-blue-200" },
  closed: { label: "Closed", className: "bg-slate-500/10 text-slate-500 border-slate-200" }
};

const priorityConfig = {
  low: { label: "Low", className: "bg-slate-100 text-slate-600" },
  medium: { label: "Medium", className: "bg-blue-100 text-blue-600" },
  high: { label: "High", className: "bg-orange-100 text-orange-600" },
  urgent: { label: "Urgent", className: "bg-red-100 text-red-600" }
};

export function StatusBadge({ status }) {
  const config = statusConfig[status] || statusConfig.open;
  return (
    <Badge variant="outline" className={`${config.className} font-medium`}>
      {config.label}
    </Badge>
  );
}

export function PriorityBadge({ priority }) {
  const config = priorityConfig[priority] || priorityConfig.medium;
  return (
    <Badge variant="secondary" className={`${config.className} font-medium`}>
      {config.label}
    </Badge>
  );
}