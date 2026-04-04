import { ArrearsReport } from "@/components/crm/reports/arrears-report";
import { LandlordStatementReport } from "@/components/crm/reports/landlord-statement-report";
import { MaintenanceReport } from "@/components/crm/reports/maintenance-report";
import { ProfitLossReport } from "@/components/crm/reports/profit-loss-report";
import { VacancyReport } from "@/components/crm/reports/vacancy-report";

export default function ReportsPage() {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">Reports</h1>
      <div className="grid gap-6">
        <ProfitLossReport />
        <LandlordStatementReport />
        <VacancyReport />
        <ArrearsReport />
        <MaintenanceReport />
      </div>
    </div>
  );
}
