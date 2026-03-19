import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, Users, Pencil, UserPlus, CheckCircle, Clock } from "lucide-react";
import EditUserDialog from "@/components/clients/EditUserDialog";
import AddUserDialog from "@/components/clients/AddUserDialog";

export default function Clients() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [editingUser, setEditingUser] = useState(null);
  const [addUserOpen, setAddUserOpen] = useState(false);

  const { data: userProfiles = [], isLoading: isLoadingProfiles } = useQuery({
    queryKey: ["userProfiles"],
    queryFn: () => base44.entities.UserProfile.list(undefined, 200),
    refetchInterval: 3000
  });

  const { data: organizations = [], isLoading: isLoadingOrgs } = useQuery({
    queryKey: ["organizations"],
    queryFn: () => base44.entities.Organization.list()
  });

  // Build merged users directly from UserProfile (better RLS for admins)
  const mergedUsers = userProfiles.map(profile => ({
    ...profile,
    id: profile.user_id,
    profile_id: profile.id
  }));

  const updateUserMutation = useMutation({
    mutationFn: async ({ userId, user_type, organization_id, organization_name, display_full_name, full_name, company_name, profile_id, status }) => {
      if (profile_id) {
        await base44.entities.UserProfile.update(profile_id, {
          user_type,
          organization_id,
          display_full_name,
          full_name,
          company_name,
          ...(status !== undefined ? { status } : {})
        });
      } else {
        await base44.entities.UserProfile.create({
          user_id: userId,
          email: mergedUsers.find(u => u.id === userId)?.email || '',
          full_name: full_name || '',
          display_full_name: display_full_name || '',
          user_type: user_type || 'client',
          organization_id: organization_id || null
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries(["userProfiles"]);
      setEditingUser(null);
    },
  });

  const deleteUserMutation = useMutation({
    mutationFn: async (profileId) => {
      await base44.entities.UserProfile.delete(profileId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries(["userProfiles"]);
      setEditingUser(null);
    },
  });

  const addUserMutation = useMutation({
    mutationFn: async ({ full_name, display_full_name, email, user_type, organization_id, user_id }) => {
      await base44.entities.UserProfile.create({
        user_id: user_id || email,
        email,
        full_name,
        display_full_name: display_full_name || full_name,
        user_type,
        organization_id: organization_id || null
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries(["userProfiles"]);
      setAddUserOpen(false);
    },
  });

  const filteredUsers = mergedUsers.filter(user =>
    user.email?.toLowerCase().includes(search.toLowerCase()) ||
    user.full_name?.toLowerCase().includes(search.toLowerCase()) ||
    user.display_full_name?.toLowerCase().includes(search.toLowerCase()) ||
    user.organization_name?.toLowerCase().includes(search.toLowerCase()) ||
    user.company_name?.toLowerCase().includes(search.toLowerCase())
  );

  const handleApproveUser = (userId) => {
    const user = mergedUsers.find(u => u.id === userId);
    updateUserMutation.mutate({
      userId,
      user_type: user.user_type || 'client',
      organization_id: user.organization_id,
      display_full_name: user.display_full_name,
      full_name: user.full_name,
      company_name: user.company_name,
      profile_id: user.profile_id,
      status: 'approved'
    });
  };

  // Group users by type
  const pendingUsers = filteredUsers.filter(u => u.status === 'pending');
  const admins = filteredUsers.filter(u => u.status !== 'pending' && (u.user_type === 'super_admin' || u.user_type === 'admin' || u.role === 'admin'));
  const engineers = filteredUsers.filter(u => u.status !== 'pending' && u.user_type === 'agent' && u.role !== 'admin');
  const clients = filteredUsers.filter(u => u.status !== 'pending' && u.user_type === 'client' && u.role !== 'admin');
  const unassigned = filteredUsers.filter(u => u.status !== 'pending' && !u.user_type && u.role !== 'admin');

  const handleUpdateUserType = (userId, newUserType) => {
    const user = mergedUsers.find(u => u.id === userId);
    updateUserMutation.mutate({ 
      userId, 
      user_type: newUserType,
      organization_id: user.organization_id,
      display_full_name: user.display_full_name,
      full_name: user.full_name,
      profile_id: user.profile_id,
      status: user.status
    });
  };

  const handleUpdateOrganization = (userId, orgId) => {
    const org = organizations.find(o => o.id === orgId);
    const user = mergedUsers.find(u => u.id === userId);
    updateUserMutation.mutate({ 
      userId, 
      user_type: user.user_type || "client",
      organization_id: orgId,
      organization_name: org?.name,
      display_full_name: user.display_full_name,
      full_name: user.full_name,
      profile_id: user.profile_id,
      status: user.status
    });
    // Also sync the User entity's organization_id so the client portal works
    base44.functions.invoke('assignUserToOrganization', {
      user_id: userId,
      organization_id: orgId
    }).catch(err => console.error("Failed to sync user organization:", err));
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
    const user = mergedUsers.find(u => u.id === userId);
    updateUserMutation.mutate({
      userId,
      user_type: formData.user_type,
      organization_id: formData.organization_id,
      organization_name: org?.name,
      full_name: formData.full_name,
      display_full_name: formData.display_full_name,
      company_name: formData.company_name,
      profile_id: user?.profile_id
    });
  };

  const handleDeleteUser = (userId) => {
    const user = mergedUsers.find(u => u.id === userId);
    deleteUserMutation.mutate(user?.profile_id || userId);
  };

  return (
    <div className="bg-gradient-to-br from-slate-50 via-white to-sky-50/30">
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
          <Button onClick={() => setAddUserOpen(true)} className="flex items-center gap-2">
            <UserPlus className="w-4 h-4" />
            Add User
          </Button>
        </div>

        {isLoadingProfiles || isLoadingOrgs ? (
          <Card className="bg-white/70 backdrop-blur-sm border-slate-200/50 shadow-sm">
            <div className="text-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-slate-400 mx-auto" />
            </div>
          </Card>
        ) : filteredUsers.length === 0 ? (
          <Card className="bg-white/70 backdrop-blur-sm border-slate-200/50 shadow-sm">
            <div className="text-center py-12 text-slate-500">
              No users found. Invite users from the Base44 dashboard.
            </div>
          </Card>
        ) : (
          <div className="space-y-8">
            {/* Pending Requests Section */}
            {pendingUsers.length > 0 && (
              <div>
                <h2 className="text-xl font-semibold text-slate-800 mb-3 flex items-center gap-2">
                  <Badge className="bg-amber-500/10 text-amber-600 flex items-center gap-1">
                    <Clock className="w-3 h-3" /> Pending Requests
                  </Badge>
                  <span className="text-sm text-slate-500 font-normal">({pendingUsers.length})</span>
                </h2>
                <Card className="bg-amber-50/50 backdrop-blur-sm border-amber-200/60 shadow-sm">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Company</TableHead>
                        <TableHead>Organisation</TableHead>
                        <TableHead>Role</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {pendingUsers.map((user) => (
                        <TableRow key={user.id} className="bg-amber-50/80">
                          <TableCell className="font-medium">{user.display_full_name || user.full_name || "-"}</TableCell>
                          <TableCell>{user.email}</TableCell>
                          <TableCell>{user.company_name || "-"}</TableCell>
                          <TableCell>
                            <Select
                              value={user.organization_id || ""}
                              onValueChange={(value) => handleUpdateOrganization(user.id, value)}
                              disabled={updateUserMutation.isPending}
                            >
                              <SelectTrigger className="w-40">
                                <SelectValue placeholder="Assign org" />
                              </SelectTrigger>
                              <SelectContent>
                                {organizations.map(org => (
                                  <SelectItem key={org.id} value={org.id}>{org.name}</SelectItem>
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
                            <div className="flex items-center justify-end gap-2">
                              <Button
                                size="sm"
                                onClick={() => handleApproveUser(user.id)}
                                disabled={updateUserMutation.isPending}
                                className="bg-emerald-600 hover:bg-emerald-700 text-white h-8 text-xs px-3 flex items-center gap-1"
                              >
                                <CheckCircle className="w-3.5 h-3.5" /> Approve
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setEditingUser(user)}
                              >
                                <Pencil className="w-4 h-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </Card>
              </div>
            )}

            {/* Admins Section */}
            {admins.length > 0 && (
              <div>
                <h2 className="text-xl font-semibold text-slate-800 mb-3 flex items-center gap-2">
                  <Badge className="bg-blue-900/10 text-blue-900">Admins</Badge>
                  <span className="text-sm text-slate-500 font-normal">({admins.length})</span>
                </h2>
                <Card className="bg-white/70 backdrop-blur-sm border-slate-200/50 shadow-sm">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Full Name</TableHead>
                        <TableHead>User Full Name</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Company Name</TableHead>
                        <TableHead>Base44 Role</TableHead>
                        <TableHead>Organisation</TableHead>
                        <TableHead>User Type</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {admins.map((user) => (
                        <TableRow key={user.id}>
                          <TableCell>{user.full_name || "-"}</TableCell>
                          <TableCell>{user.display_full_name || user.full_name || "-"}</TableCell>
                          <TableCell>{user.email}</TableCell>
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
                      ))}
                    </TableBody>
                  </Table>
                </Card>
              </div>
            )}

            {/* Engineers Section */}
            {engineers.length > 0 && (
              <div>
                <h2 className="text-xl font-semibold text-slate-800 mb-3 flex items-center gap-2">
                  <Badge className="bg-sky-500/10 text-sky-600">Engineers</Badge>
                  <span className="text-sm text-slate-500 font-normal">({engineers.length})</span>
                </h2>
                <Card className="bg-white/70 backdrop-blur-sm border-slate-200/50 shadow-sm">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Full Name</TableHead>
                        <TableHead>User Full Name</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Company Name</TableHead>
                        <TableHead>Base44 Role</TableHead>
                        <TableHead>Organisation</TableHead>
                        <TableHead>User Type</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {engineers.map((user) => (
                        <TableRow key={user.id}>
                          <TableCell>{user.full_name || "-"}</TableCell>
                          <TableCell>{user.display_full_name || user.full_name || "-"}</TableCell>
                          <TableCell>{user.email}</TableCell>
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
                      ))}
                    </TableBody>
                  </Table>
                </Card>
              </div>
            )}

            {/* Unassigned Section */}
            {unassigned.length > 0 && (
              <div>
                <h2 className="text-xl font-semibold text-slate-800 mb-3 flex items-center gap-2">
                  <Badge className="bg-amber-500/10 text-amber-600">Unassigned</Badge>
                  <span className="text-sm text-slate-500 font-normal">({unassigned.length})</span>
                </h2>
                <Card className="bg-white/70 backdrop-blur-sm border-slate-200/50 shadow-sm">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Full Name</TableHead>
                        <TableHead>User Full Name</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Company Name</TableHead>
                        <TableHead>Base44 Role</TableHead>
                        <TableHead>Organisation</TableHead>
                        <TableHead>User Type</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {unassigned.map((user) => (
                        <TableRow key={user.id} className="bg-amber-50/50">
                          <TableCell>{user.full_name || "-"}</TableCell>
                          <TableCell>{user.display_full_name || user.full_name || "-"}</TableCell>
                          <TableCell>{user.email}</TableCell>
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
                              value={user.user_type || ""}
                              onValueChange={(value) => handleUpdateUserType(user.id, value)}
                              disabled={updateUserMutation.isPending}
                            >
                              <SelectTrigger className="w-32">
                                <SelectValue placeholder="Assign role" />
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
                      ))}
                    </TableBody>
                  </Table>
                </Card>
              </div>
            )}

            {/* Clients Section */}
            {clients.length > 0 && (
              <div>
                <h2 className="text-xl font-semibold text-slate-800 mb-3 flex items-center gap-2">
                  <Badge className="bg-slate-500/10 text-slate-600">Clients</Badge>
                  <span className="text-sm text-slate-500 font-normal">({clients.length})</span>
                </h2>
                <Card className="bg-white/70 backdrop-blur-sm border-slate-200/50 shadow-sm">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Full Name</TableHead>
                        <TableHead>User Full Name</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Company Name</TableHead>
                        <TableHead>Base44 Role</TableHead>
                        <TableHead>Organisation</TableHead>
                        <TableHead>User Type</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {clients.map((user) => (
                        <TableRow key={user.id}>
                          <TableCell>{user.full_name || "-"}</TableCell>
                          <TableCell>{user.display_full_name || user.full_name || "-"}</TableCell>
                          <TableCell>{user.email}</TableCell>
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
                      ))}
                    </TableBody>
                  </Table>
                </Card>
              </div>
            )}
          </div>
        )}

        <AddUserDialog
          open={addUserOpen}
          onOpenChange={setAddUserOpen}
          organizations={organizations}
          onAdd={(form) => addUserMutation.mutate(form)}
          isSaving={addUserMutation.isPending}
          existingProfileEmails={userProfiles.map(p => p.email)}
        />

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