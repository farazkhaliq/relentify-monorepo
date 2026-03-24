import { DashboardStats } from "@/components/dashboard-stats";
import { MaintenancePriorityChart } from "@/components/maintenance-priority-chart";
import { PropertyStatusChart } from "@/components/property-status-chart";
import { RecentActivity } from "@/components/recent-activity";
import { TasksOverview } from "@/components/tasks-overview";
import { TransactionSummaryChart } from "@/components/transaction-summary-chart";

export default function DashboardPage() {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">Dashboard</h1>
      <DashboardStats />
      <div className="grid gap-6 md:grid-cols-2">
        <RecentActivity />
        <TasksOverview />
      </div>
      <div className="grid gap-6 md:grid-cols-2">
        <PropertyStatusChart />
        <MaintenancePriorityChart />
      </div>
      <TransactionSummaryChart />
    </div>
  );
}
