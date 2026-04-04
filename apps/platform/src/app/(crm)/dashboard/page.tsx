import { DashboardStats } from "@/components/crm/dashboard-stats";
import { MaintenancePriorityChart } from "@/components/crm/maintenance-priority-chart";
import { PropertyStatusChart } from "@/components/crm/property-status-chart";
import { RecentActivity } from "@/components/crm/recent-activity";
import { TasksOverview } from "@/components/crm/tasks-overview";
import { TransactionSummaryChart } from "@/components/crm/transaction-summary-chart";

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
