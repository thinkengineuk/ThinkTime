import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { Clock, TrendingUp, Users, AlertCircle } from "lucide-react";
import { format } from "date-fns";

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

export default function Reports() {
  const [selectedOrg, setSelectedOrg] = useState(null);
  const [selectedClient, setSelectedClient] = useState(null);

  const { data: user } = useQuery({
    queryKey: ["currentUser"],
    queryFn: () => base44.auth.me()
  });

  const { data: organizations = [] } = useQuery({
    queryKey: ["organizations"],
    queryFn: () => base44.entities.Organization.list()
  });

  const { data: timeLogs = [] } = useQuery({
    queryKey: ["timeLogs"],
    queryFn: () => base44.entities.TimeLog.list()
  });

  const { data: tickets = [] } = useQuery({
    queryKey: ["allTickets"],
    queryFn: () => base44.entities.Ticket.list()
  });

  // Redirect non-admins
  if (user && user.user_type !== "super_admin" && user.role !== "admin") {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <Card className="p-8 text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h1 className="text-xl font-bold text-slate-900 mb-2">Access Denied</h1>
          <p className="text-slate-600">Only administrators can view reports.</p>
        </Card>
      </div>
    );
  }

  const orgId = selectedOrg || organizations[0]?.id;
  const currentOrg = organizations.find(o => o.id === orgId);

  const filteredLogs = orgId 
    ? timeLogs.filter(log => log.organization_id === orgId)
    : timeLogs;

  const orgTickets = orgId 
    ? tickets.filter(t => t.organization_id === orgId)
    : tickets;

  const clientEmails = [...new Set(filteredLogs.map(log => log.client_email))];
  const logsForClient = selectedClient 
    ? filteredLogs.filter(log => log.client_email === selectedClient)
    : filteredLogs;

  // Time per ticket
  const timePerTicket = orgTickets.map(ticket => {
    const logs = filteredLogs.filter(log => log.ticket_id === ticket.id);
    const totalMinutes = logs.reduce((sum, log) => sum + (log.actual_minutes || 0), 0);
    return {
      displayId: ticket.display_id,
      subject: ticket.subject,
      minutes: totalMinutes,
      hours: (totalMinutes / 60).toFixed(1),
      entries: logs.length
    };
  }).filter(t => t.minutes > 0).sort((a, b) => b.minutes - a.minutes);

  // Time per client
  const timePerClient = clientEmails.map(email => {
    const logs = filteredLogs.filter(log => log.client_email === email);
    const totalMinutes = logs.reduce((sum, log) => sum + (log.actual_minutes || 0), 0);
    const clientName = logs[0]?.client_name || email;
    return {
      name: clientName,
      email,
      minutes: totalMinutes,
      hours: (totalMinutes / 60).toFixed(1),
      allocated: currentOrg?.monthly_allocation_minutes || 120,
      remaining: Math.max(0, (currentOrg?.monthly_allocation_minutes || 120) - totalMinutes),
      percentUsed: Math.round(((totalMinutes / (currentOrg?.monthly_allocation_minutes || 120)) * 100))
    };
  }).sort((a, b) => b.minutes - a.minutes);

  // Profitability analysis - time overages
  const profitability = clientEmails.map(email => {
    const logs = filteredLogs.filter(log => log.client_email === email);
    const totalMinutes = logs.reduce((sum, log) => sum + (log.actual_minutes || 0), 0);
    const allocated = currentOrg?.monthly_allocation_minutes || 120;
    const overage = Math.max(0, totalMinutes - allocated);
    return {
      name: logs[0]?.client_name || email,
      email,
      used: totalMinutes,
      allocated,
      overage,
      percentUsed: Math.round(((totalMinutes / allocated) * 100))
    };
  }).filter(p => p.used > 0);

  // Time per agent
  const agentStats = {};
  filteredLogs.forEach(log => {
    if (!agentStats[log.user_email]) {
      agentStats[log.user_email] = {
        name: log.user_name,
        email: log.user_email,
        minutes: 0,
        entries: 0
      };
    }
    agentStats[log.user_email].minutes += log.actual_minutes || 0;
    agentStats[log.user_email].entries += 1;
  });

  const agentData = Object.values(agentStats).sort((a, b) => b.minutes - a.minutes);

  const totalMinutesLogged = filteredLogs.reduce((sum, log) => sum + (log.actual_minutes || 0), 0);
  const totalEntriesLogged = filteredLogs.length;
  const avgMinutesPerEntry = totalEntriesLogged > 0 ? (totalMinutesLogged / totalEntriesLogged).toFixed(1) : 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900 mb-4">Time Tracking Reports</h1>
          
          {/* Org Selector */}
          <div className="flex gap-4 mb-6">
            <div className="w-64">
              <label className="text-xs font-semibold text-slate-600 block mb-2">Organization</label>
              <Select value={selectedOrg || ""} onValueChange={setSelectedOrg}>
                <SelectTrigger>
                  <SelectValue placeholder="All Organizations" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={null}>All Organizations</SelectItem>
                  {organizations.map(org => (
                    <SelectItem key={org.id} value={org.id}>
                      {org.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {clientEmails.length > 0 && (
              <div className="w-64">
                <label className="text-xs font-semibold text-slate-600 block mb-2">Client</label>
                <Select value={selectedClient || ""} onValueChange={setSelectedClient}>
                  <SelectTrigger>
                    <SelectValue placeholder="All Clients" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={null}>All Clients</SelectItem>
                    {clientEmails.map(email => (
                      <SelectItem key={email} value={email}>
                        {timeLogs.find(log => log.client_email === email)?.client_name || email}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
        </div>

        {/* Summary Stats */}
        <div className="grid md:grid-cols-4 gap-4 mb-8">
          <Card className="p-4 bg-white/70 backdrop-blur-sm border-slate-200/50">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-500 font-semibold mb-1">Total Time Logged</p>
                <p className="text-2xl font-bold text-slate-900">
                  {(totalMinutesLogged / 60).toFixed(1)}h
                </p>
                <p className="text-xs text-slate-400 mt-1">{totalMinutesLogged} minutes</p>
              </div>
              <Clock className="w-8 h-8 text-blue-500 opacity-50" />
            </div>
          </Card>

          <Card className="p-4 bg-white/70 backdrop-blur-sm border-slate-200/50">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-500 font-semibold mb-1">Time Entries</p>
                <p className="text-2xl font-bold text-slate-900">{totalEntriesLogged}</p>
                <p className="text-xs text-slate-400 mt-1">{avgMinutesPerEntry} min avg</p>
              </div>
              <TrendingUp className="w-8 h-8 text-indigo-500 opacity-50" />
            </div>
          </Card>

          <Card className="p-4 bg-white/70 backdrop-blur-sm border-slate-200/50">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-500 font-semibold mb-1">Unique Clients</p>
                <p className="text-2xl font-bold text-slate-900">{clientEmails.length}</p>
                <p className="text-xs text-slate-400 mt-1">tracked</p>
              </div>
              <Users className="w-8 h-8 text-green-500 opacity-50" />
            </div>
          </Card>

          <Card className="p-4 bg-white/70 backdrop-blur-sm border-slate-200/50">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-500 font-semibold mb-1">Agents</p>
                <p className="text-2xl font-bold text-slate-900">{agentData.length}</p>
                <p className="text-xs text-slate-400 mt-1">active</p>
              </div>
              <Users className="w-8 h-8 text-purple-500 opacity-50" />
            </div>
          </Card>
        </div>

        <div className="grid lg:grid-cols-2 gap-6 mb-8">
          {/* Time per Ticket Chart */}
          <Card className="p-6 bg-white/70 backdrop-blur-sm border-slate-200/50">
            <h2 className="font-semibold text-slate-900 mb-4">Time per Ticket</h2>
            {timePerTicket.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={timePerTicket}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="displayId" />
                  <YAxis />
                  <Tooltip formatter={(value) => `${value} min`} />
                  <Bar dataKey="minutes" fill="#3b82f6" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-slate-500 text-center py-8">No time entries yet</p>
            )}
          </Card>

          {/* Time per Agent */}
          <Card className="p-6 bg-white/70 backdrop-blur-sm border-slate-200/50">
            <h2 className="font-semibold text-slate-900 mb-4">Time per Agent</h2>
            {agentData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={agentData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" angle={-45} textAnchor="end" height={80} />
                  <YAxis />
                  <Tooltip formatter={(value) => `${value} min`} />
                  <Bar dataKey="minutes" fill="#10b981" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-slate-500 text-center py-8">No data available</p>
            )}
          </Card>
        </div>

        {/* Client Retainer Status */}
        <Card className="p-6 bg-white/70 backdrop-blur-sm border-slate-200/50 mb-8">
          <h2 className="font-semibold text-slate-900 mb-6">Client Retainer Status</h2>
          <div className="space-y-4">
            {timePerClient.length > 0 ? (
              timePerClient.map((client) => (
                <div key={client.email} className="border border-slate-200 rounded-lg p-4 hover:bg-slate-50 transition-colors">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <p className="font-semibold text-slate-900">{client.name}</p>
                      <p className="text-xs text-slate-500">{client.email}</p>
                    </div>
                    <Badge 
                      className={client.percentUsed > 100 ? "bg-red-100 text-red-800" : client.percentUsed > 80 ? "bg-amber-100 text-amber-800" : "bg-green-100 text-green-800"}
                    >
                      {client.percentUsed}% used
                    </Badge>
                  </div>
                  
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-slate-600">Used: {client.hours}h ({client.minutes} min)</span>
                      <span className="text-slate-600">Allocated: {(client.allocated / 60).toFixed(1)}h</span>
                    </div>
                    <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
                      <div 
                        className={`h-full ${client.percentUsed > 100 ? 'bg-red-500' : client.percentUsed > 80 ? 'bg-amber-500' : 'bg-green-500'}`}
                        style={{ width: `${Math.min(100, client.percentUsed)}%` }}
                      />
                    </div>
                    {client.remaining > 0 && (
                      <p className="text-xs text-green-600">
                        {(client.remaining / 60).toFixed(1)}h ({client.remaining} min) remaining
                      </p>
                    )}
                    {client.remaining < 0 && (
                      <p className="text-xs text-red-600">
                        {(Math.abs(client.remaining) / 60).toFixed(1)}h ({Math.abs(client.remaining)} min) over allocation
                      </p>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <p className="text-slate-500 text-center py-8">No client data available</p>
            )}
          </div>
        </Card>

        {/* Time per Ticket Table */}
        {timePerTicket.length > 0 && (
          <Card className="p-6 bg-white/70 backdrop-blur-sm border-slate-200/50">
            <h2 className="font-semibold text-slate-900 mb-4">Ticket Details</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-slate-200">
                  <tr>
                    <th className="text-left py-2 px-3 font-semibold text-slate-700">Ticket</th>
                    <th className="text-left py-2 px-3 font-semibold text-slate-700">Subject</th>
                    <th className="text-right py-2 px-3 font-semibold text-slate-700">Time (min)</th>
                    <th className="text-right py-2 px-3 font-semibold text-slate-700">Time (hrs)</th>
                    <th className="text-right py-2 px-3 font-semibold text-slate-700">Entries</th>
                  </tr>
                </thead>
                <tbody>
                  {timePerTicket.map((ticket, idx) => (
                    <tr key={idx} className="border-b border-slate-100 hover:bg-slate-50">
                      <td className="py-3 px-3">
                        <Badge variant="outline">{ticket.displayId}</Badge>
                      </td>
                      <td className="py-3 px-3 text-slate-700 max-w-xs truncate">{ticket.subject}</td>
                      <td className="py-3 px-3 text-right">{ticket.minutes}</td>
                      <td className="py-3 px-3 text-right font-semibold">{ticket.hours}h</td>
                      <td className="py-3 px-3 text-right text-slate-500">{ticket.entries}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}