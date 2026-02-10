import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, Users, Pencil } from "lucide-react";
import EditUserDialog from "@/components/clients/EditUserDialog";

export default function Clients() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [editingUser, setEditingUser] = useState(null);

  const { data: usersData = [], isLoading: isLoadingUsers } = useQuery({
    queryKey: ["users"],
    queryFn: () => base44.entities.User.list(),
    refetchInterval: 3000 // Auto-refresh every 3 seconds
  });

  const { data: userProfiles = [], isLoading: isLoadingProfiles } = useQuery({
    queryKey: ["userProfiles"],
    queryFn: () => base44.entities.UserProfile.list(),
    refetchInterval: 3000
  });

  const { data: organizations = [], isLoading: isLoadingOrgs } = useQuery({
    queryKey: ["organizations"],
    queryFn: () => base44.entities.Organization.list()
  });

  // Merge User and UserProfile data
  const users = usersData.map(user => {
    const profile = userProfiles.find(p => p.user_id === user.id);
    return {
      ...user,
      full_name: profile?.full_name || user.full_name,
      company_name: profile?.company_name,
      user_type: profile?.user_type,
      organization_id: profile?.organization_id || user.organization_id,
      userProfileId: profile?.id
    };
  });

  const updateUserMutation = useMutation({
    mutationFn: async ({ userId, userProfileId, user_type, organization_id, organization_name, company_name, full_name }) => {
      await base44.entities.User.update(userId, { 
        user_type,
        organization_id,
        organization_name
      });
      if (userProfileId) {
        await base44.entities.UserProfile.update(userProfileId, {
          full_name,
          company_name,
          user_type,
          organization_id
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries(["users"]);
      queryClient.invalidateQueries(["userProfiles"]);
      setEditingUser(null);
    },
  });

  const deleteUserMutation = useMutation({
    mutationFn: async (userId) => {
      await base44.entities.User.delete(userId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries(["users"]);
      queryClient.invalidateQueries(["userProfiles"]);
      setEditingUser(null);
    },
  });

  const filteredUsers = users.filter(user =>
    user.email?.toLowerCase().includes(search.toLowerCase()) ||
    user.full_name?.toLowerCase().includes(search.toLowerCase()) ||
    user.organization_name?.toLowerCase().includes(search.toLowerCase()) ||
    user.company_name?.toLowerCase().includes(search.toLowerCase())
  );

  const handleUpdateUserType = (userId, newUserType) => {
    const user = users.find(u => u.id === userId);
    updateUserMutation.mutate({ 
      userId,
      userProfileId: user.userProfileId,
      user_type: newUserType,
      organization_id: user.organization_id,
      organization_name: user.organization_name,
      company_name: user.company_name,
      full_name: user.full_name
    });
  };

  const handleUpdateOrganization = (userId, orgId) => {
    const org = organizations.find(o => o.id === orgId);
    const user = users.find(u => u.id === userId);
    updateUserMutation.mutate({ 
      userId,
      userProfileId: user.userProfileId,
      user_type: user.user_type || "client",
      organization_id: orgId,
      organization_name: org?.name,
      company_name: user.company_name,
      full_name: user.full_name
    });
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

  const handleSaveUser = (userId, formData) => {
    const org = organizations.find(o => o.id === formData.organization_id);
    const user = users.find(u => u.id === userId);
    updateUserMutation.mutate({
      userId,
      userProfileId: user.userProfileId,
      user_type: formData.user_type,
      organization_id: formData.organization_id,
      organization_name: org?.name,
      company_name: formData.company_name,
      full_name: formData.full_name
    });
  };

  const handleDeleteUser = (userId) => {
    deleteUserMutation.mutate(userId);
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

        <div className="flex items-center justify-between mb-6">
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
                <TableHead>Company Name</TableHead>
                <TableHead>Base44 Role</TableHead>
                <TableHead>Organisation</TableHead>
                <TableHead>User Type</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoadingUsers || isLoadingOrgs || isLoadingProfiles ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin text-slate-400 mx-auto" />
                  </TableCell>
                </TableRow>
              ) : filteredUsers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-slate-500">
                    No users found. Invite users from the Base44 dashboard.
                  </TableCell>
                </TableRow>
              ) : (
                filteredUsers.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell className="font-medium">{user.email}</TableCell>
                    <TableCell>{user.full_name || "-"}</TableCell>
                    <TableCell>{user.company_name || "-"}</TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {user.role === "admin" ? "Admin" : "User"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Select
                        value={user.organization_id || ""}
                        onValueChange={(value) => handleUpdateOrganization(user.id, value)}
                        disabled={updateUserMutation.isPending}
                      >
                        <SelectTrigger className="w-40">
                          <SelectValue placeholder="Select org" />
                        </SelectTrigger>
                        <SelectContent>
                          {organizations.map(org => (
                            <SelectItem key={org.id} value={org.id}>
                              {org.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Select
                        value={user.user_type || "client"}
                        onValueChange={(value) => handleUpdateUserType(user.id, value)}
                        disabled={updateUserMutation.isPending}
                      >
                        <SelectTrigger className="w-32">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="client">Client</SelectItem>
                          <SelectItem value="agent">Engineer</SelectItem>
                          <SelectItem value="super_admin">Admin</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setEditingUser(user)}
                      >
                        <Pencil className="w-4 h-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </Card>

        <EditUserDialog
          open={!!editingUser}
          onOpenChange={(open) => !open && setEditingUser(null)}
          user={editingUser}
          organizations={organizations}
          onSave={handleSaveUser}
          onDelete={handleDeleteUser}
          isSaving={updateUserMutation.isPending}
          isDeleting={deleteUserMutation.isPending}
        />
      </div>
    </div>
  );
}