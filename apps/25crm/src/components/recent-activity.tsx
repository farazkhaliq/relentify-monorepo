'use client';

import React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@relentify/ui";
import { formatDistanceToNow } from "date-fns";
import { useCollection, useFirestore, useMemoFirebase } from "@/firebase";
import { useUserProfile } from "@/hooks/use-user-profile";
import { collection, query, orderBy, limit, Timestamp, where } from "firebase/firestore";
import { Skeleton } from "@relentify/ui";
import { Wrench, UserPlus, ShieldAlert, FileText } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

const ItemIcon = ({ type }: { type: 'maintenance' | 'lead' | 'arrears' | 'application' }) => {
    const baseClasses = "flex h-9 w-9 items-center justify-center rounded-lg";
    if (type === 'maintenance') {
        return <div className={cn(baseClasses, "bg-destructive/10 text-destructive")}><Wrench className="h-5 w-5" /></div>
    }
    if (type === 'arrears') {
        return <div className={cn(baseClasses, "bg-destructive/10 text-destructive")}><ShieldAlert className="h-5 w-5" /></div>
    }
    if (type === 'application') {
        return <div className={cn(baseClasses, "bg-accent/10 text-accent")}><FileText className="h-5 w-5" /></div>
    }
    // Default to lead
    return <div className={cn(baseClasses, "bg-primary/10 text-primary")}><UserPlus className="h-5 w-5" /></div>
}

export function RecentActivity() {
  const [items, setItems] = React.useState<any[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);

  React.useEffect(() => {
    const fetchActivity = async () => {
      try {
        const res = await fetch('/api/reports/recent-activity');
        if (res.ok) {
          const data = await res.json();
          setItems(data);
        }
      } catch (error) {
        console.error('Error fetching recent activity:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchActivity();
  }, []);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent Activity</CardTitle>
        <CardDescription>Prioritized alerts and new items requiring your attention.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {isLoading ? (
            Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-start gap-4">
                    <Skeleton className="h-9 w-9 rounded-lg" />
                    <div className="flex-1 space-y-2">
                        <Skeleton className="h-4 w-4/5" />
                        <Skeleton className="h-3 w-1/4" />
                    </div>
                </div>
            ))
          ) : items && items.length > 0 ? (
            items.map((item) => (
              <div key={`${item.type}-${item.id}`} className="flex items-start gap-4">
                <ItemIcon type={item.type} />
                <div className="flex-1">
                  <Link href={item.href} className="hover:underline">
                    <p className="text-sm font-medium leading-snug truncate pr-4">
                      {item.title}
                    </p>
                  </Link>
                  <p className="text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(item.date), { addSuffix: true })}
                  </p>
                </div>
              </div>
            ))
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4">Inbox is clear!</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
