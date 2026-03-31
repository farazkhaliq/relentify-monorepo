'use client';

import React, { useState, useEffect, useMemo } from "react";
import { format, formatDistanceToNow } from 'date-fns';
import { Mail, Phone, MessageSquare, Archive, Trash2, PlusSquare, Link as LinkIcon, User, Home, FileText, Lightbulb, Reply, ReplyAll, Forward, MailOpen, Sparkles } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@relentify/ui";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@relentify/ui";
import { useApiCollection, useApiDoc, apiUpdate } from '@/hooks/use-api';
import { useUserProfile } from '@/hooks/use-user-profile';
import { Skeleton } from "@relentify/ui";
import { Separator } from "@relentify/ui";
import { Avatar, AvatarFallback } from "@relentify/ui";
import { cn } from "@/lib/utils";
import { Button } from "@relentify/ui";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@relentify/ui";
import { useToast } from '@/hooks/use-toast';
import { Badge } from "@relentify/ui";
import Link from "next/link";
import { AddTaskDialog } from "@/components/add-task-dialog";
import { useSearchParams } from "next/navigation";
import { LogCommunicationDialog } from "@/components/log-communication-dialog";
import { Table, TableBody, TableCell, TableHeader, TableRow, TableHead } from "@relentify/ui";
import { analyzeCommunication, type AnalyzeCommunicationOutput } from "@/ai/flows/analyze-communication-flow";
import { useOrganization } from '@/hooks/use-organization';

// Define a type for communication for stronger typing
interface Communication {
    id: string;
    subject?: string;
    body?: string;
    contact_id?: string;
    contact_name?: string;
    direction: 'Inbound' | 'Outbound';
    sent_at?: string;
    status: 'Sent' | 'Received' | 'Read' | 'Archived' | 'Trashed';
    type: 'Email' | 'Call' | 'WhatsApp';
    related_property_id?: string;
    related_tenancy_id?: string;
}

export default function CommunicationsPage() {
  const { toast } = useToast();
  const searchParams = useSearchParams();
  const emailId = searchParams.get('emailId');

  const [selectedEmail, setSelectedEmail] = useState<Communication | null>(null);
  const [editingLog, setEditingLog] = useState<Communication | null>(null);
  const [isAddTaskOpen, setAddTaskOpen] = useState(false);
  const [addTaskDefaults, setAddTaskDefaults] = useState<any>(null);
  const [isLogCommDialogOpen, setLogCommDialogOpen] = useState(false);
  const [commTypeToLog, setCommTypeToLog] = useState<'Call' | 'WhatsApp'>('Call');
  const [aiSuggestions, setAiSuggestions] = useState<AnalyzeCommunicationOutput | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const { userProfile: currentUserProfile, isLoading: loadingCurrentUser, isAdmin } = useUserProfile();
  const { organization, isLoading: isLoadingOrg } = useOrganization();
  const organizationId = currentUserProfile?.organizationId;

  // --- Data Fetching for all communication types ---
  const { data: emails, isLoading: loadingEmails } = useApiCollection<Communication>('/api/communications?type=Email');
  const { data: calls, isLoading: loadingCalls } = useApiCollection<Communication>('/api/communications?type=Call');
  const { data: whatsappMessages, isLoading: loadingWhatsapp } = useApiCollection<Communication>('/api/communications?type=WhatsApp');

  // --- Data for linked entities ---
  const { data: allContacts, isLoading: loadingAllContacts } = useApiCollection<any>('/api/contacts');
  const { data: allProperties, isLoading: loadingAllProperties } = useApiCollection<any>('/api/properties');

  const contactNameMap = React.useMemo(() => new Map(allContacts?.map((c: any) => [c.id, `${c.first_name} ${c.last_name}`]) || []), [allContacts]);

  // Fetch linked entities for selected email
  const linkedContact = useMemo(() => {
    if (!selectedEmail?.contact_id || !allContacts) return null;
    return allContacts.find((c: any) => c.id === selectedEmail.contact_id) || null;
  }, [selectedEmail?.contact_id, allContacts]);

  const linkedProperty = useMemo(() => {
    if (!selectedEmail?.related_property_id || !allProperties) return null;
    return allProperties.find((p: any) => p.id === selectedEmail.related_property_id) || null;
  }, [selectedEmail?.related_property_id, allProperties]);

  const { data: linkedTenancy } = useApiDoc<any>(
    selectedEmail?.related_tenancy_id ? `/api/tenancies/${selectedEmail.related_tenancy_id}` : null
  );

  const suggestedPropertyFromAI = useMemo(() => {
    if (!aiSuggestions?.potentialPropertyName || !allProperties) return null;
    const searchString = aiSuggestions.potentialPropertyName.toLowerCase();
    return allProperties.find((p: any) => p.address?.toLowerCase().includes(searchString) || searchString.includes(p.address?.toLowerCase()));
  }, [aiSuggestions, allProperties]);


  const getTimestampAsDate = (timestamp: any): Date => {
    if (!timestamp) return new Date();
    if (typeof timestamp === 'string') { return new Date(timestamp); }
    if (timestamp instanceof Date) { return timestamp; }
    return new Date();
  };

  useEffect(() => {
    if (!emails || emails.length === 0) {
        setSelectedEmail(null);
        return;
    }

    const emailToSelect = emailId ? emails.find(e => e.id === emailId) : emails[0];

    if (emailToSelect) {
        setSelectedEmail(emailToSelect);
    } else if (!selectedEmail || !emails.find(e => e.id === selectedEmail.id)) {
        setSelectedEmail(emails[0]);
    }
  }, [emails, emailId]);

  useEffect(() => {
    if (selectedEmail) {
        if (selectedEmail.status === 'Received') {
            apiUpdate(`/api/communications/${selectedEmail.id}`, { status: 'Read' }).catch(() => {});
        }

        if (organization?.aiEnabled) {
            const runAnalysis = async () => {
                setIsAnalyzing(true);
                setAiSuggestions(null);
                try {
                    const suggestions = await analyzeCommunication({
                        subject: selectedEmail.subject,
                        body: selectedEmail.body,
                    });
                    setAiSuggestions(suggestions);
                } catch (error) {
                    console.error("AI analysis failed:", error);
                } finally {
                    setIsAnalyzing(false);
                }
            };
            runAnalysis();
        }
    }
  }, [selectedEmail?.id, organization?.aiEnabled]);


  const handleUpdateStatus = async (status: 'Archived' | 'Trashed') => {
    if (!selectedEmail) return;
    try {
      await apiUpdate(`/api/communications/${selectedEmail.id}`, { status });
      toast({ title: `Email moved to ${status === 'Trashed' ? 'trash' : 'archive'}` });
    } catch {
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to update status.' });
    }
  }

  const handleMarkUnread = async () => {
    if (!selectedEmail || !emails) return;

    const currentIndex = emails.findIndex(e => e.id === selectedEmail.id);
    const nextIndex = currentIndex !== -1 && currentIndex < emails.length - 1 ? currentIndex + 1 : currentIndex - 1;
    const nextEmail = emails[nextIndex] || null;

    try {
      await apiUpdate(`/api/communications/${selectedEmail.id}`, { status: 'Received' });
      toast({ title: "Marked as unread" });
      setSelectedEmail(nextEmail);
    } catch {
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to mark as unread.' });
    }
  }

  const handleCreateTask = () => {
    if (!selectedEmail) return;
    setAddTaskDefaults({
      title: `Follow up on: ${selectedEmail.subject}`,
      description: `Task related to email.\n\n--- Email Body ---\n${selectedEmail.body}`,
    });
    setAddTaskOpen(true);
  };

  const handleCreateMaintenanceTask = () => {
    if (!selectedEmail || !aiSuggestions) return;
    setAddTaskDefaults({
      title: `Maintenance: ${aiSuggestions.summary || selectedEmail.subject}`,
      description: `Task automatically suggested from email.\n\n--- Email Body ---\n${selectedEmail.body}`,
      relatedPropertyId: suggestedPropertyFromAI?.id,
      priority: 'Medium',
    });
    setAddTaskOpen(true);
  };

  const handleLinkContact = async (contactId: string) => {
    if (!selectedEmail) return;
    try {
      await apiUpdate(`/api/communications/${selectedEmail.id}`, { contact_id: contactId });
      toast({ title: 'Contact Linked', description: 'The contact has been successfully linked to this email.' });
    } catch {
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to link contact.' });
    }
  }

  const handleLinkProperty = async (propertyId: string) => {
    if (!selectedEmail) return;
    try {
      await apiUpdate(`/api/communications/${selectedEmail.id}`, { related_property_id: propertyId });
      toast({ title: 'Property Linked', description: 'The property has been successfully linked to this email.' });
    } catch {
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to link property.' });
    }
  }

  const handleLogCommClick = (type: 'Call' | 'WhatsApp') => {
    setCommTypeToLog(type);
    setLogCommDialogOpen(true);
  };

  const handleDialogClose = (isOpen: boolean) => {
    if (!isOpen) {
        setLogCommDialogOpen(false);
        setEditingLog(null);
    }
  }

  const isRelatedLoading = loadingAllContacts || loadingAllProperties || (organization?.aiEnabled && isAnalyzing);
  const isLoading = loadingEmails || loadingCurrentUser || loadingCalls || loadingWhatsapp || loadingAllContacts || loadingAllProperties || isLoadingOrg;

  return (
    <>
    <AddTaskDialog open={isAddTaskOpen} onOpenChange={setAddTaskOpen} defaultValues={addTaskDefaults} />
    {organizationId && <LogCommunicationDialog
        open={isLogCommDialogOpen || !!editingLog}
        onOpenChange={handleDialogClose}
        communicationType={commTypeToLog}
        organizationId={organizationId}
        communication={editingLog}
        isAdmin={isAdmin}
    />}

    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">Communications</h1>
      <Tabs defaultValue="email" className="w-full">
        <TabsList className="grid w-full grid-cols-3 md:w-[400px]">
          <TabsTrigger value="email"><Mail className="mr-2 h-4 w-4" />Email</TabsTrigger>
          <TabsTrigger value="calls"><Phone className="mr-2 h-4 w-4" />Calls</TabsTrigger>
          <TabsTrigger value="whatsapp"><MessageSquare className="mr-2 h-4 w-4" />WhatsApp</TabsTrigger>
        </TabsList>

        <TabsContent value="email">
          <div className="grid grid-cols-1 md:grid-cols-[350px_1fr] gap-4 h-[calc(100vh-240px)]">
            <Card className="flex flex-col h-full">
              <CardHeader>
                <CardTitle>Inbox</CardTitle>
                <CardDescription>{isLoading ? 'Loading...' : `${emails?.length || 0} messages`}</CardDescription>
              </CardHeader>
              <CardContent className="p-0 flex-1 overflow-y-auto">
                <div className="flex flex-col">
                  {isLoading ? (
                    Array.from({ length: 10 }).map((_, i) => (
                      <div key={i} className="flex flex-col gap-1 p-4 border-b">
                        <Skeleton className="h-4 w-2/3" />
                        <Skeleton className="h-4 w-1/2" />
                        <Skeleton className="h-3 w-full mt-1" />
                      </div>
                    ))
                  ) : emails && emails.length > 0 ? (
                    emails.map((email) => (
                      <button key={email.id} onClick={() => setSelectedEmail(email)} className={cn("flex items-start gap-3 p-4 border-b text-left hover:bg-muted/50 transition-colors", selectedEmail?.id === email.id && "bg-muted")}>
                        {email.status === 'Received' && (<div className="h-2.5 w-2.5 shrink-0 rounded-full bg-[var(--theme-accent)] mt-1.5" />)}
                        <div className={cn("flex-1 grid gap-0.5", email.status !== 'Received' && 'pl-[14px]')}>
                            <div className="flex items-center justify-between">
                                <p className={cn("font-semibold text-sm truncate", email.status === 'Received' && "font-bold")}>{email.contact_name || 'Unknown'}</p>
                                <p className="text-xs text-muted-foreground">{formatDistanceToNow(getTimestampAsDate(email.sent_at), { addSuffix: true })}</p>
                            </div>
                            <p className={cn("font-medium text-sm truncate", email.status === 'Received' && "font-bold")}>{email.subject}</p>
                            <p className="text-xs text-muted-foreground truncate">{email.body}</p>
                        </div>
                      </button>
                    ))
                  ) : (
                    <div className="p-4 text-center text-sm text-muted-foreground">No emails found.</div>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card className="flex flex-col h-full">
                {selectedEmail || isLoading ? (
                    <>
                    <CardHeader className="border-b">
                         <div className="flex items-center justify-between gap-2">
                           <div className="flex items-center gap-1.5">
                               <TooltipProvider>
                                    <Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon"><Reply className="h-4 w-4" /></Button></TooltipTrigger><TooltipContent>Reply</TooltipContent></Tooltip>
                                    <Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon"><ReplyAll className="h-4 w-4" /></Button></TooltipTrigger><TooltipContent>Reply All</TooltipContent></Tooltip>
                                    <Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon"><Forward className="h-4 w-4" /></Button></TooltipTrigger><TooltipContent>Forward</TooltipContent></Tooltip>
                               </TooltipProvider>
                            </div>
                            <div className="flex items-center gap-1">
                                <TooltipProvider>
                                    <Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon" onClick={handleMarkUnread} disabled={!selectedEmail || isLoading}><MailOpen className="h-4 w-4" /></Button></TooltipTrigger><TooltipContent>Mark as unread</TooltipContent></Tooltip>
                                    <Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon" onClick={handleCreateTask} disabled={!selectedEmail || isLoading}><PlusSquare className="h-4 w-4" /></Button></TooltipTrigger><TooltipContent>Create Task</TooltipContent></Tooltip>
                                    <Separator orientation="vertical" className="h-6 mx-1" />
                                    <Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon" onClick={() => handleUpdateStatus('Archived')} disabled={!selectedEmail || isLoading}><Archive className="h-4 w-4" /></Button></TooltipTrigger><TooltipContent>Archive</TooltipContent></Tooltip>
                                    <Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon" onClick={() => handleUpdateStatus('Trashed')} disabled={!selectedEmail || isLoading}><Trash2 className="h-4 w-4" /></Button></TooltipTrigger><TooltipContent>Delete</TooltipContent></Tooltip>
                                </TooltipProvider>
                            </div>
                        </div>
                        <Separator className="my-2" />
                        <div className="flex items-center gap-3 mt-4">
                            {isLoading ? <Skeleton className="h-10 w-10 rounded-full" /> : <Avatar><AvatarFallback>{(selectedEmail?.contact_name || 'U').substring(0, 2).toUpperCase()}</AvatarFallback></Avatar>}
                            <div className="grid gap-0.5">
                                {isLoading ? (<><Skeleton className="h-4 w-32" /><Skeleton className="h-3 w-48" /></>) : (<><p className="font-semibold">{selectedEmail?.contact_name || 'Unknown'}</p><p className="text-xs text-muted-foreground">{selectedEmail?.direction}</p></>)}
                            </div>
                        </div>
                        <div className="mt-4">
                            {isLoading ? <Skeleton className="h-6 w-3/4" /> : <h2 className="text-xl font-bold">{selectedEmail?.subject}</h2>}
                            {isLoading ? <Skeleton className="h-4 w-24 mt-1" /> : <p className="text-sm text-muted-foreground">{format(getTimestampAsDate(selectedEmail?.sent_at), 'PPP p')}</p>}
                        </div>

                        {organization?.aiEnabled && aiSuggestions && aiSuggestions.suggestedAction !== 'None' && (
                            <div className="p-3 bg-primary/5 border border-primary/20 rounded-lg mt-4">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <Sparkles className="h-5 w-5 text-primary" />
                                        <h4 className="font-semibold">AI Assistant</h4>
                                    </div>
                                    {aiSuggestions.suggestedCategory && <Badge variant="outline">{aiSuggestions.suggestedCategory}</Badge>}
                                </div>
                                <p className="text-sm text-muted-foreground mt-2 pl-7">{aiSuggestions.summary}</p>
                                <div className="pl-7 mt-3">
                                    {aiSuggestions.suggestedAction === 'Create Maintenance Task' && (
                                        <Button size="sm" onClick={handleCreateMaintenanceTask}>
                                            <PlusSquare className="mr-2 h-4 w-4" /> Create Maintenance Task
                                        </Button>
                                    )}
                                    {aiSuggestions.suggestedAction === 'Create Follow-up Task' && (
                                        <Button size="sm" onClick={handleCreateTask}>
                                            <PlusSquare className="mr-2 h-4 w-4" /> Create Follow-up Task
                                        </Button>
                                    )}
                                    {aiSuggestions.suggestedAction === 'Archive' && (
                                        <Button size="sm" variant="secondary" onClick={() => handleUpdateStatus('Archived')}>
                                            <Archive className="mr-2 h-4 w-4" /> Archive Email
                                        </Button>
                                    )}
                                </div>
                            </div>
                        )}

                        <Separator className="mt-4" />
                         <div className="flex flex-wrap items-center gap-2 mt-4">
                           {isRelatedLoading && organization?.aiEnabled && (<Badge variant="outline" className="font-normal border-dashed"><Sparkles className="h-3 w-3 mr-1.5 text-[var(--theme-warning)] animate-spin" />Analyzing...</Badge>)}
                           {linkedContact && (<Badge variant="zinc" className="font-normal"><User className="h-3 w-3 mr-1.5" /><Link href={`/contacts/${linkedContact.id}`} className="hover:underline">{linkedContact.first_name} {linkedContact.last_name}</Link></Badge>)}
                           {linkedProperty && (<Badge variant="zinc" className="font-normal"><Home className="h-3 w-3 mr-1.5" /><Link href={`/properties/${linkedProperty.id}`} className="hover:underline">{linkedProperty.address}</Link></Badge>)}
                           {linkedTenancy && (<Badge variant="zinc" className="font-normal"><FileText className="h-3 w-3 mr-1.5" /><Link href={`/tenancies/${linkedTenancy.id}`} className="hover:underline">Tenancy Agreement</Link></Badge>)}

                           {organization?.aiEnabled && (
                            <>
                                {suggestedPropertyFromAI && !linkedProperty && (
                                        <Badge variant="outline" className="font-normal border-dashed items-center"><Lightbulb className="h-3 w-3 mr-1.5 text-[var(--theme-warning)]" /><span>AI Suggestion: Link to {suggestedPropertyFromAI.address}</span><Button size="xs" variant="ghost" className="ml-2 h-auto px-1 py-0" onClick={() => handleLinkProperty(suggestedPropertyFromAI.id)}>Link</Button></Badge>
                                )}
                            </>
                           )}

                           {!isRelatedLoading && !linkedContact && !linkedProperty && !linkedTenancy && (<span className="text-sm text-muted-foreground">Not linked to any entities.</span>)}
                        </div>
                    </CardHeader>
                    <CardContent className="p-6 flex-1 overflow-y-auto">
                        {isLoading ? (<div className="space-y-2"><Skeleton className="h-4 w-full" /><Skeleton className="h-4 w-full" /><Skeleton className="h-4 w-5/6" /></div>) : (<div className="prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap">{selectedEmail?.body}</div>)}
                    </CardContent>
                    </>
                ) : (
                    <div className="flex flex-col items-center justify-center h-full text-center p-8">
                        <Mail className="h-12 w-12 text-muted-foreground" />
                        <h3 className="text-xl font-semibold mt-4">No Email Selected</h3>
                        <p className="text-muted-foreground mt-1">Select an email from the list to view its content.</p>
                    </div>
                )}
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="calls">
            <Card>
                <CardHeader className="flex-row items-center justify-between">
                    <div>
                        <CardTitle>Call Logs</CardTitle>
                        <CardDescription>View and manage all logged calls.</CardDescription>
                    </div>
                    <Button onClick={() => handleLogCommClick('Call')}>Log Call</Button>
                </CardHeader>
                <CardContent>
                   <Table>
                    <TableHeader><TableRow><TableHead>Contact</TableHead><TableHead>Summary</TableHead><TableHead>Direction</TableHead><TableHead className="text-right">Date</TableHead></TableRow></TableHeader>
                    <TableBody>
                        {isLoading ? Array.from({length: 3}).map((_, i) => <TableRow key={i}><TableCell><Skeleton className="h-5 w-24" /></TableCell><TableCell><Skeleton className="h-5 w-48" /></TableCell><TableCell><Skeleton className="h-6 w-20" /></TableCell><TableCell><Skeleton className="h-5 w-24 ml-auto" /></TableCell></TableRow>) :
                        calls && calls.length > 0 ? calls.map(call => (
                            <TableRow key={call.id} className="cursor-pointer" onClick={() => { setCommTypeToLog('Call'); setEditingLog(call); }}>
                                <TableCell>{call.contact_name || contactNameMap.get(call.contact_id || '') || 'N/A'}</TableCell>
                                <TableCell className="font-medium">{call.subject || 'No Subject'}</TableCell>
                                <TableCell><Badge variant={call.direction === 'Inbound' ? 'secondary' : 'default'}>{call.direction}</Badge></TableCell>
                                <TableCell className="text-right text-sm text-muted-foreground">{formatDistanceToNow(getTimestampAsDate(call.sent_at), { addSuffix: true })}</TableCell>
                            </TableRow>
                        )) : <TableRow><TableCell colSpan={4} className="text-center h-24">No calls logged.</TableCell></TableRow>}
                    </TableBody>
                   </Table>
                </CardContent>
            </Card>
        </TabsContent>
        <TabsContent value="whatsapp">
             <Card>
                <CardHeader className="flex-row items-center justify-between">
                    <div>
                        <CardTitle>WhatsApp Logs</CardTitle>
                        <CardDescription>View and manage all logged WhatsApp messages.</CardDescription>
                    </div>
                    <Button onClick={() => handleLogCommClick('WhatsApp')}>Log Message</Button>
                </CardHeader>
                <CardContent>
                   <Table>
                    <TableHeader><TableRow><TableHead>Contact</TableHead><TableHead>Summary</TableHead><TableHead>Direction</TableHead><TableHead className="text-right">Date</TableHead></TableRow></TableHeader>
                    <TableBody>
                        {isLoading ? Array.from({length: 3}).map((_, i) => <TableRow key={i}><TableCell><Skeleton className="h-5 w-24" /></TableCell><TableCell><Skeleton className="h-5 w-48" /></TableCell><TableCell><Skeleton className="h-6 w-20" /></TableCell><TableCell><Skeleton className="h-5 w-24 ml-auto" /></TableCell></TableRow>) :
                        whatsappMessages && whatsappMessages.length > 0 ? whatsappMessages.map(msg => (
                            <TableRow key={msg.id} className="cursor-pointer" onClick={() => { setCommTypeToLog('WhatsApp'); setEditingLog(msg); }}>
                                <TableCell>{msg.contact_name || contactNameMap.get(msg.contact_id || '') || 'N/A'}</TableCell>
                                <TableCell className="font-medium">{msg.subject || 'No Subject'}</TableCell>
                                <TableCell><Badge variant={msg.direction === 'Inbound' ? 'secondary' : 'default'}>{msg.direction}</Badge></TableCell>
                                <TableCell className="text-right text-sm text-muted-foreground">{formatDistanceToNow(getTimestampAsDate(msg.sent_at), { addSuffix: true })}</TableCell>
                            </TableRow>
                        )) : <TableRow><TableCell colSpan={4} className="text-center h-24">No WhatsApp messages logged.</TableCell></TableRow>}
                    </TableBody>
                   </Table>
                </CardContent>
            </Card>
        </TabsContent>
      </Tabs>
    </div>
    </>
  );
}
