import BirthdayWidget from "@/components/dashboard/BirthdayWidget";
import PendingEventsWidget from "@/components/dashboard/PendingEventsWidget";

export default function DashboardPage() {
  return (
    <div className="space-y-6 max-w-5xl">
      <h1 className="text-2xl font-bold text-white">Dashboard</h1>
      <div className="grid gap-6 sm:grid-cols-2">
        <BirthdayWidget />
        <PendingEventsWidget />
      </div>
    </div>
  );
}
