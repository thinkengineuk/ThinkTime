import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Search, Filter, X } from "lucide-react";

export default function TicketFilters({ 
  filters, 
  setFilters, 
  organizations,
  showOrgFilter = true,
  tickets = []
}) {
  const handleReset = () => {
    setFilters({
      status: "all",
      priority: "all",
      organization: "all",
      company: "all",
      search: ""
    });
  };

  // Extract unique companies from tickets
  const companies = [...new Set(tickets.map(t => t.client_name).filter(Boolean))].sort();

  const hasActiveFilters = filters.status !== "all" || 
                           filters.priority !== "all" || 
                           filters.organization !== "all" ||
                           filters.company !== "all" ||
                           filters.search;

  return (
    <div className="flex flex-wrap items-center gap-3 p-4 bg-white rounded-xl border border-slate-100">
      <div className="relative flex-1 min-w-[200px]">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <Input
          placeholder="Search tickets..."
          value={filters.search}
          onChange={(e) => setFilters({ ...filters, search: e.target.value })}
          className="pl-9 bg-slate-50 border-0 focus-visible:ring-1"
        />
      </div>

      <Select value={filters.status} onValueChange={(v) => setFilters({ ...filters, status: v })}>
        <SelectTrigger className="w-[140px] bg-slate-50 border-0">
          <SelectValue placeholder="Status" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Status</SelectItem>
          <SelectItem value="open">Open</SelectItem>
          <SelectItem value="pending">Pending</SelectItem>
          <SelectItem value="resolved">Resolved</SelectItem>
          <SelectItem value="closed">Closed</SelectItem>
        </SelectContent>
      </Select>

      <Select value={filters.priority} onValueChange={(v) => setFilters({ ...filters, priority: v })}>
        <SelectTrigger className="w-[140px] bg-slate-50 border-0">
          <SelectValue placeholder="Priority" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Priority</SelectItem>
          <SelectItem value="urgent">Urgent</SelectItem>
          <SelectItem value="high">High</SelectItem>
          <SelectItem value="medium">Medium</SelectItem>
          <SelectItem value="low">Low</SelectItem>
        </SelectContent>
      </Select>

      {showOrgFilter && organizations?.length > 0 && (
        <Select value={filters.organization} onValueChange={(v) => setFilters({ ...filters, organization: v })}>
          <SelectTrigger className="w-[160px] bg-slate-50 border-0">
            <SelectValue placeholder="All Organisations" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Organisations</SelectItem>
            {organizations.map(org => (
              <SelectItem key={org.id} value={org.id}>{org.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {companies.length > 0 && (
        <Select value={filters.company} onValueChange={(v) => setFilters({ ...filters, company: v })}>
          <SelectTrigger className="w-[160px] bg-slate-50 border-0">
            <SelectValue placeholder="All Companies" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Companies</SelectItem>
            {companies.map(company => (
              <SelectItem key={company} value={company}>{company}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {hasActiveFilters && (
        <Button variant="ghost" size="sm" onClick={handleReset} className="text-slate-500">
          <X className="w-4 h-4 mr-1" />
          Clear
        </Button>
      )}
    </div>
  );
}