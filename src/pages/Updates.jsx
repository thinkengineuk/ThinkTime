import AnnouncementManager from "@/components/announcements/AnnouncementManager";

export default function Updates() {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">Updates & Announcements</h1>
        <p className="text-slate-500 mt-1">Stay informed about new features and important updates</p>
      </div>
      <AnnouncementManager />
    </div>
  );
}