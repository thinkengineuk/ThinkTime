import { Bell, Megaphone, AtSign, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { formatDistanceToNow } from "date-fns";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";

export default function NotificationBell({ userEmail }) {
  const queryClient = useQueryClient();

  const { data: notifications = [] } = useQuery({
    queryKey: ["notifications", userEmail],
    queryFn: () => base44.entities.Notification.filter(
      { user_email: userEmail },
      '-created_date',
      50
    ),
    refetchInterval: 10000, // Refresh every 10 seconds
    enabled: !!userEmail
  });

  const unreadCount = notifications.filter(n => !n.is_read).length;

  const markAsReadMutation = useMutation({
    mutationFn: (notificationId) => 
      base44.entities.Notification.update(notificationId, { is_read: true }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    }
  });

  const markAllAsReadMutation = useMutation({
    mutationFn: async () => {
      const unreadNotifications = notifications.filter(n => !n.is_read);
      await Promise.all(
        unreadNotifications.map(n => 
          base44.entities.Notification.update(n.id, { is_read: true })
        )
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    }
  });

  const { data: announcements = [] } = useQuery({
    queryKey: ["announcements"],
    queryFn: () => base44.entities.Announcement.list(),
    enabled: !!userEmail
  });

  const handleNotificationClick = (notification) => {
    if (!notification.is_read) {
      markAsReadMutation.mutate(notification.id);
    }
  };

  const getAnnouncementLink = (notification) => {
    const announcement = announcements.find(a => a.id === notification.announcement_id);
    return announcement?.link_url;
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="w-5 h-5" />
          {unreadCount > 0 && (
            <Badge 
              className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 bg-red-500 text-white text-xs"
            >
              {unreadCount > 9 ? '9+' : unreadCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-96 p-0" align="end">
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="font-semibold">Notifications</h3>
          {unreadCount > 0 && (
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => markAllAsReadMutation.mutate()}
              className="text-xs text-blue-600"
            >
              Mark all as read
            </Button>
          )}
        </div>
        
        <ScrollArea className="h-[400px]">
          {notifications.length === 0 ? (
            <div className="p-8 text-center text-slate-500">
              <Bell className="w-8 h-8 mx-auto mb-2 text-slate-300" />
              <p className="text-sm">No notifications yet</p>
            </div>
          ) : (
            <div className="divide-y">
              {notifications.map(notification => {
                const isAnnouncement = notification.type === 'announcement';
                const announcementLink = isAnnouncement ? getAnnouncementLink(notification) : null;
                
                if (isAnnouncement && announcementLink) {
                  return (
                    <a
                      key={notification.id}
                      href={announcementLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => handleNotificationClick(notification)}
                      className={`block p-4 hover:bg-slate-50 transition-colors ${
                        !notification.is_read ? 'bg-blue-50/50' : ''
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <Megaphone className={`w-4 h-4 mt-1 flex-shrink-0 ${
                          !notification.is_read ? 'text-blue-500' : 'text-slate-400'
                        }`} />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-slate-900 flex items-center gap-1">
                            {notification.title}
                            <ExternalLink className="w-3 h-3 text-slate-400" />
                          </p>
                          <p className="text-xs text-slate-600 mt-1 line-clamp-2">
                            {notification.message}
                          </p>
                          <p className="text-xs text-slate-400 mt-1">
                            {formatDistanceToNow(new Date(notification.created_date), { addSuffix: true })}
                          </p>
                        </div>
                      </div>
                    </a>
                  );
                }
                
                if (isAnnouncement) {
                  return (
                    <div
                      key={notification.id}
                      onClick={() => handleNotificationClick(notification)}
                      className={`block p-4 hover:bg-slate-50 transition-colors cursor-pointer ${
                        !notification.is_read ? 'bg-blue-50/50' : ''
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <Megaphone className={`w-4 h-4 mt-1 flex-shrink-0 ${
                          !notification.is_read ? 'text-blue-500' : 'text-slate-400'
                        }`} />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-slate-900">
                            {notification.title}
                          </p>
                          <p className="text-xs text-slate-600 mt-1 line-clamp-2">
                            {notification.message}
                          </p>
                          <p className="text-xs text-slate-400 mt-1">
                            {formatDistanceToNow(new Date(notification.created_date), { addSuffix: true })}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                }
                
                return (
                  <Link
                    key={notification.id}
                    to={createPageUrl(`TicketDetail?id=${notification.ticket_id}`)}
                    onClick={() => handleNotificationClick(notification)}
                    className={`block p-4 hover:bg-slate-50 transition-colors ${
                      !notification.is_read ? 'bg-blue-50/50' : ''
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <AtSign className={`w-4 h-4 mt-1 flex-shrink-0 ${
                        !notification.is_read ? 'text-blue-500' : 'text-slate-400'
                      }`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-900">
                          {notification.mentioned_by_name} mentioned you in #{notification.ticket_display_id}
                        </p>
                        <p className="text-xs text-slate-600 mt-1 line-clamp-2">
                          {notification.message}
                        </p>
                        <p className="text-xs text-slate-400 mt-1">
                          {formatDistanceToNow(new Date(notification.created_date), { addSuffix: true })}
                        </p>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}