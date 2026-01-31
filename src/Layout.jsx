import { Link, useLocation } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { 
  LayoutDashboard, 
  Clock, 
  Settings, 
  LogOut,
  User,
  Building2,
  Menu,
  X
} from "lucide-react";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export default function Layout({ children, currentPageName }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const { data: user, isLoading: isLoadingProfile } = useQuery({
    queryKey: ["currentUser"],
    queryFn: () => base44.auth.me()
  });

  // Notify admins on first login
  useEffect(() => {
    const notifyFirstLogin = async () => {
      if (!user || user.has_logged_in_before) return;
      
      try {
        await base44.auth.updateMe({ has_logged_in_before: true });
        await base44.functions.invoke('sendInviteAcceptedNotification', {
          event: { type: 'update' },
          data: { email: user.email, full_name: user.full_name }
        });
      } catch (error) {
        console.error("Error notifying first login:", error);
      }
    };
    
    notifyFirstLogin();
  }, [user?.email]);

  const isAgent = user?.user_type === "agent" || 
                  user?.user_type === "super_admin" || 
                  user?.role === "admin";

  const adminPages = ["Dashboard", "Clients", "Settings"];
  const isAdminPage = adminPages.includes(currentPageName);
  const isClient = user && !isAgent;

  // Redirect clients away from admin pages
  useEffect(() => {
    if (isLoadingProfile || !user) return;
    
    if (isClient && isAdminPage) {
      window.location.replace(createPageUrl("ClientPortal"));
    }
  }, [isAgent, currentPageName, isLoadingProfile, user, isClient, isAdminPage]);

  const navItems = isAgent ? [
    { name: "Dashboard", icon: LayoutDashboard, page: "Dashboard" },
    { name: "Clients", icon: User, page: "Clients" },
    { name: "Settings", icon: Settings, page: "Settings" },
  ] : [
    { name: "My Tickets", icon: Clock, page: "ClientPortal" },
  ];

  const handleLogout = () => {
    base44.auth.logout();
  };

  // Block rendering of admin pages for clients - show loading instead
  if (isLoadingProfile || (isClient && isAdminPage)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-white to-sky-50/30">
        <Loader2 className="w-8 h-8 animate-spin text-sky-500" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-sky-50 via-white to-blue-50">
      {/* Top Navigation */}
      <nav className="bg-white/80 backdrop-blur-md border-b border-slate-200/50 sticky top-0 z-50 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <div className="flex items-center gap-8">
              <Link 
                to={createPageUrl(isAgent ? "Dashboard" : "ClientPortal")}
                className="flex items-center gap-2"
              >
                <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-sky-500 to-blue-900 flex items-center justify-center shadow-lg shadow-sky-500/30">
                  <Clock className="w-4 h-4 text-white" />
                </div>
                <span className="font-bold bg-gradient-to-r from-sky-500 to-blue-900 bg-clip-text text-transparent hidden sm:block">
                  ThinkTime
                </span>
              </Link>

              {/* Desktop Nav */}
              <div className="hidden md:flex items-center gap-1">
                {navItems.map(item => (
                  <Link
                    key={item.page}
                    to={createPageUrl(item.page)}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                      currentPageName === item.page 
                        ? 'bg-blue-50 text-blue-600' 
                        : 'text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <item.icon className="w-4 h-4" />
                    {item.name}
                  </Link>
                ))}
              </div>
            </div>

            {/* Right Side */}
            <div className="flex items-center gap-3">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center">
                      <User className="w-4 h-4 text-slate-600" />
                    </div>
                    <span className="hidden sm:block text-sm font-medium text-slate-700">
                      {user?.full_name || user?.email}
                    </span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <div className="px-2 py-1.5">
                    <p className="text-sm font-medium">{user?.full_name}</p>
                    <p className="text-xs text-slate-500">{user?.email}</p>
                  </div>
                  <DropdownMenuSeparator />
                  {isAgent && (
                    <DropdownMenuItem className="text-slate-600">
                      <Building2 className="w-4 h-4 mr-2" />
                      {user?.user_type || "Agent"}
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleLogout} className="text-red-600">
                    <LogOut className="w-4 h-4 mr-2" />
                    Sign out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              {/* Mobile Menu Button */}
              <Button 
                variant="ghost" 
                size="icon"
                className="md:hidden"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              >
                {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </Button>
            </div>
          </div>
        </div>

        {/* Mobile Nav */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-slate-100 bg-white">
            <div className="px-4 py-3 space-y-1">
              {navItems.map(item => (
                <Link
                  key={item.page}
                  to={createPageUrl(item.page)}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    currentPageName === item.page 
                      ? 'bg-blue-50 text-blue-600' 
                      : 'text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <item.icon className="w-4 h-4" />
                  {item.name}
                </Link>
              ))}
            </div>
          </div>
        )}
      </nav>

      {/* Page Content */}
      <main>{children}</main>
    </div>
  );
}