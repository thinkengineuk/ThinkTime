import { Button } from "@/components/ui/button";
import { Building2 } from "lucide-react";

export default function OrgSwitcher({ organizations, selectedOrg, onSelect }) {
  return (
    <div className="flex items-center gap-2 p-1 bg-slate-100 rounded-lg">
      <Button
        variant={selectedOrg === "all" ? "default" : "ghost"}
        size="sm"
        onClick={() => onSelect("all")}
        className="text-xs"
      >
        All
      </Button>
      {organizations.map(org => (
        <Button
          key={org.id}
          variant={selectedOrg === org.id ? "default" : "ghost"}
          size="sm"
          onClick={() => onSelect(org.id)}
          className="text-xs"
          style={selectedOrg === org.id ? { backgroundColor: org.branding_color } : {}}
        >
          <Building2 className="w-3 h-3 mr-1" />
          {org.prefix}
        </Button>
      ))}
    </div>
  );
}