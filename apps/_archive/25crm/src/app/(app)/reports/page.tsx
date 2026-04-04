import { ArrearsReport } from "@/components/reports/arrears-report";
import { LandlordStatementReport } from "@/components/reports/landlord-statement-report";
import { MaintenanceReport } from "@/components/reports/maintenance-report";
import { ProfitLossReport } from "@/components/reports/profit-loss-report";
import { VacancyReport } from "@/components/reports/vacancy-report";

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
