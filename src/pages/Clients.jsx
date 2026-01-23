import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Users } from "lucide-react";

export default function Clients() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [newClientEmail, setNewClientEmail] = useState("");
  const [newClientOrg, setNewClientOrg] = useState("");
  const [newClientUserType, setNewClientUserType] = useState("client");

  const { data: users = [], isLoading: isLoadingUsers } = useQuery({
    queryKey: ["users"],
    queryFn: () => base44.entities.User.list()
  });

  const { data: organizations = [], isLoading: isLoadingOrgs } = useQuery({
    queryKey: ["organizations"],
    queryFn: () => base44.entities.Organization.list()
  });

  const inviteUserMutation = useMutation({
    mutationFn: async ({ email, organization_id, organization_name, user_type }) => {
      const existingUsers = await base44.entities.User.filter({ email });
      if (existingUsers.length > 0) {
        await base44.entities.User.update(existingUsers[0].id, { 
          organization_id, 
          organization_name, 
          user_type 
        });
      } else {
        await base44.entities.User.create({ 
          email, 
          organization_id, 
          organization_name, 
          user_type 
        });
        await base44.users.inviteUser(email, user_type === "super_admin" ? "admin" : "user");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries(["users"]);
      setNewClientEmail("");
      setNewClientOrg("");
      setNewClientUserType("client");
    },
  });

  const filteredUsers = users.filter(user =>
    user.email?.toLowerCase().includes(search.toLowerCase()) ||
    user.full_name?.toLowerCase().includes(search.toLowerCase()) ||
    user.organization_name?.toLowerCase().includes(search.toLowerCase())
  );

  const handleInvite = () => {
    if (newClientEmail && newClientOrg && newClientUserType) {
      const org = organizations.find(o => o.id === newClientOrg);
      inviteUserMutation.mutate({ 
        email: newClientEmail, 
        organization_id: newClientOrg, 
        organization_name: org?.name,
        user_type: newClientUserType
      });
    }
  };

  const getUserTypeLabel = (type) => {
    const labels = {
      super_admin: "Admin",
      agent: "Engineer",
      client: "Client"
    };
    return labels[type] || type;
  };

  const getUserTypeBadge = (type) => {
    const variants = {
      super_admin: "bg-blue-900/10 text-blue-900",
      agent: "bg-sky-500/10 text-sky-600",
      client: "bg-slate-500/10 text-slate-600"
    };
    return variants[type] || "bg-slate-500/10 text-slate-600";
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-sky-50/30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-sky-500 to-blue-900 flex items-center justify-center shadow-lg shadow-sky-500/30">
            <Users className="w-5 h-5 text-white" />
          </div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-sky-500 to-blue-900 bg-clip-text text-transparent">
            Client Management
          </h1>
        </div>

        <Card className="p-6 mb-8 bg-white/70 backdrop-blur-sm border-slate-200/50 shadow-sm">
          <h2 className="text-lg font-semibold mb-4 text-slate-900">Invite User or Update Role</h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="user@example.com"
                value={newClientEmail}
                onChange={(e) => setNewClientEmail(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="organization">Organization</Label>
              <Select
                value={newClientOrg}
                onValueChange={setNewClientOrg}
                disabled={isLoadingOrgs}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select Organization" />
                </SelectTrigger>
                <SelectContent>
                  {organizations.map(org => (
                    <SelectItem key={org.id} value={org.id}>
                      {org.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="userType">User Type</Label>
              <Select
                value={newClientUserType}
                onValueChange={setNewClientUserType}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select User Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="client">Client</SelectItem>
                  <SelectItem value="agent">Engineer</SelectItem>
                  <SelectItem value="super_admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button 
              onClick={handleInvite} 
              disabled={inviteUserMutation.isPending || !newClientEmail || !newClientOrg || !newClientUserType}
              className="bg-gradient-to-r from-sky-500 to-blue-900 hover:from-sky-600 hover:to-blue-950"
            >
              {inviteUserMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {inviteUserMutation.isPending ? "Processing..." : "Invite / Update"}
            </Button>
          </div>
        </Card>

        <div className="flex items-center justify-between mb-4">
          <Input
            placeholder="Search users..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="max-w-sm bg-white/70 backdrop-blur-sm border-slate-200/50 shadow-sm"
          />
        </div>

        <Card className="bg-white/70 backdrop-blur-sm border-slate-200/50 shadow-sm">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Email</TableHead>
                <TableHead>Full Name</TableHead>
                <TableHead>Organization</TableHead>
                <TableHead>User Type</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoadingUsers || isLoadingOrgs ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin text-slate-400 mx-auto" />
                  </TableCell>
                </TableRow>
              ) : filteredUsers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-8 text-slate-500">
                    No users found.
                  </TableCell>
                </TableRow>
              ) : (
                filteredUsers.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell className="font-medium">{user.email}</TableCell>
                    <TableCell>{user.full_name || "-"}</TableCell>
                    <TableCell>{user.organization_name || "N/A"}</TableCell>
                    <TableCell>
                      <Badge className={getUserTypeBadge(user.user_type)}>
                        {getUserTypeLabel(user.user_type)}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </Card>
      </div>
    </div>
  );
}