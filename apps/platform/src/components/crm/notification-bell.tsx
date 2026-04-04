'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Bell } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import Link from 'next/link';

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@relentify/ui';
import { Button } from '@relentify/ui';
import { Skeleton } from '@relentify/ui';
import { Separator } from '@relentify/ui';

interface Notification {
    id: string;
    title: string;
    message: string;
    link?: string;
    is_read: boolean;
    created_at: string;
}

export function NotificationBell() {
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isOpen, setIsOpen] = useState(false);

    const fetchNotifications = useCallback(async () => {
        try {
            const res = await fetch('/api/notifications');
            if (res.ok) {
                const data = await res.json();
                setNotifications(data);
            }
        } catch (error) {
            console.error('Error fetching notifications:', error);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchNotifications();
        const interval = setInterval(fetchNotifications, 60000);
        return () => clearInterval(interval);
    }, [fetchNotifications]);

    const unreadCount = notifications?.filter(n => !n.is_read).length || 0;

    useEffect(() => {
        if (isOpen && unreadCount > 0) {
            // Mark all unread as read via API
            const unread = notifications.filter(n => !n.is_read);
            Promise.all(
                unread.map(n =>
                    fetch(`/api/notifications/${n.id}`, {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ is_read: true }),
                    }).catch(() => {})
                )
            ).then(() => {
                setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
            });
        }
    // Only trigger when popover opens with unread items
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen]);

    return (
        <Popover open={isOpen} onOpenChange={setIsOpen}>
            <PopoverTrigger asChild>
                <Button variant="ghost" size="icon" className="relative h-9 w-9">
                    <Bell className="h-5 w-5" />
                    {unreadCount > 0 && (
                        <span className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-xs font-bold text-destructive-foreground">
                            {unreadCount}
                        </span>
                    )}
                    <span className="sr-only">Toggle notifications</span>
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80 p-0" align="end">
                <div className="flex items-center justify-between p-4">
                    <h3 className="font-medium">Notifications</h3>
                </div>
                <Separator />
                <div className="flex flex-col">
                    {isLoading ? (
                        <div className="p-4 space-y-4">
                            <Skeleton className="h-10 w-full" />
                            <Skeleton className="h-10 w-full" />
                            <Skeleton className="h-10 w-full" />
                        </div>
                    ) : notifications && notifications.length > 0 ? (
                        notifications.map(notif => (
                            <div key={notif.id} className="border-b last:border-b-0">
                                <Link href={notif.link || '#'} className={`block p-4 hover:bg-muted/50 ${!notif.is_read ? 'bg-primary/5' : ''}`}>
                                    <p className="font-semibold text-sm">{notif.title}</p>
                                    <p className="text-sm text-muted-foreground">{notif.message}</p>
                                    <p className="text-xs text-muted-foreground mt-1">
                                        {notif.created_at ? formatDistanceToNow(new Date(notif.created_at), { addSuffix: true }) : ''}
                                    </p>
                                </Link>
                            </div>
                        ))
                    ) : (
                        <p className="p-4 text-center text-sm text-muted-foreground">You have no notifications.</p>
                    )}
                </div>
            </PopoverContent>
        </Popover>
    );
}
