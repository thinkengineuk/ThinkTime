import { Button } from "@/components/ui/button";

export default function OrgSwitcher({ organizations, selectedOrg, onSelect }) {
  return (
    <div className="flex items-center gap-2 p-1 bg-white/50 backdrop-blur-sm rounded-xl border border-slate-200/50 shadow-sm">
      <Button
        variant={selectedOrg === "all" ? "default" : "ghost"}
        size="sm"
        onClick={() => onSelect("all")}
        className="text-xs font-medium"
      >
        All
      </Button>
      {organizations.map(org => (
        <Button
          key={org.id}
          variant={selectedOrg === org.id ? "default" : "ghost"}
          size="sm"
          onClick={() => onSelect(org.id)}
          className="text-xs font-medium flex items-center gap-2"
          style={selectedOrg === org.id ? { backgroundColor: org.branding_color, color: 'white' } : {}}
        >
          {org.logo_url && (
            <img src={org.logo_url} alt={org.name} className="w-4 h-4 object-contain" />
          )}
          {org.name}
        </Button>
      ))}
    </div>
  );
}