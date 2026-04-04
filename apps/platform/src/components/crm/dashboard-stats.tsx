'use client';

import { useEffect, useState } from "react";
import { Building, UserCheck, UserPlus, Wrench } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@relentify/ui";
import { Skeleton } from "@relentify/ui";

export function DashboardStats() {
    const [statsData, setStatsData] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchStats = async () => {
            try {
                const res = await fetch('/api/reports/dashboard-stats');
                if (res.ok) {
                    const data = await res.json();
                    setStatsData(data);
                }
            } catch (error) {
                console.error('Error fetching dashboard stats:', error);
            } finally {
                setIsLoading(false);
            }
        };

        fetchStats();
    }, []);
    
    const stats = [
        { title: "Total Properties", value: statsData?.totalProperties ?? 0, icon: Building, loading: isLoading },
        { title: "Active Tenants", value: statsData?.activeTenants ?? 0, icon: UserCheck, loading: isLoading },
        { title: "New Leads", value: statsData?.newLeads ?? 0, icon: UserPlus, loading: isLoading },
        { title: "Open Maintenance", value: statsData?.openMaintenance ?? 0, icon: Wrench, loading: isLoading },
    ];

    return (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {stats.map((stat) => (
                <Card key={stat.title}>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
                        <stat.icon className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        {stat.loading ? <Skeleton className="h-8 w-1/4" /> : <div className="text-2xl font-bold">{stat.value}</div>}
                    </CardContent>
                </Card>
            ))}
        </div>
    );
}
