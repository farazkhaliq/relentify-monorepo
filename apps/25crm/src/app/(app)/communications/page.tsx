'use client';

import React, { useState, useEffect, useMemo } from "react";
import { collection, query, where, orderBy, Timestamp, doc, limit } from 'firebase/firestore';
import { format, formatDistanceToNow } from 'date-fns';
import { Mail, Phone, MessageSquare, Archive, Trash2, PlusSquare, Link as LinkIcon, User, Home, FileText, Lightbulb, Reply, ReplyAll, Forward, MailOpen, Sparkles } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@relentify/ui";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@relentify/ui";
import { useCollection, useFirestore, useMemoFirebase, useDoc, useAuth, updateDocumentNonBlocking } from '@/firebase';
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
import { LinkEntityDialog } from "@/components/link-entity-dialog";
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
    fromAddress?: string;
    toAddresses?: string[];
    direction: 'Inbound' | 'Outbound';
    timestamp: any; // Can be Timestamp or string
    status: 'Sent' | 'Received' | 'Read' | 'Archived' | 'Trashed';
    communicationType: 'Email' | 'Call' | 'WhatsApp';
    relatedContactIds?: string[];
    relatedPropertyId?: string;
    relatedTenancyId?: string;
}

export default function CommunicationsPage() {
  const firestore = useFirestore();
  const { toast } = useToast();
  const auth = useAuth();
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
  const emailsQuery = useMemoFirebase(() => (firestore && organizationId) ? query(collection(firestore, `organizations/${organizationId}/communications`), where('communicationType', '==', 'Email'), where('status', 'in', ['Sent', 'Received', 'Read']), orderBy('timestamp', 'desc')) : null, [firestore, organizationId]);
  const { data: emails, isLoading: loadingEmails } = useCollection<Communication>(emailsQuery);
  
  const callsQuery = useMemoFirebase(() => (firestore && organizationId) ? query(collection(firestore, `organizations/${organizationId}/communications`), where('communicationType', '==', 'Call'), orderBy('timestamp', 'desc')) : null, [firestore, organizationId]);
  const { data: calls, isLoading: loadingCalls } = useCollection<Communication>(callsQuery);

  const whatsappQuery = useMemoFirebase(() => (firestore && organizationId) ? query(collection(firestore, `organizations/${organizationId}/communications`), where('communicationType', '==', 'WhatsApp'), orderBy('timestamp', 'desc')) : null, [firestore, organizationId]);
  const { data: whatsappMessages, isLoading: loadingWhatsapp } = useCollection<Communication>(whatsappQuery);
  
  // --- Data for linked entities and suggestions ---
  const allPropertiesQuery = useMemoFirebase(() => (firestore && organizationId) ? collection(firestore, `organizations/${organizationId}/properties`) : null, [firestore, organizationId]);
  const { data: allProperties, isLoading: loadingAllProperties } = useCollection<any>(allPropertiesQuery);
  
  const linkedContactsQuery = useMemoFirebase(() => {
    if (!firestore || !organizationId || !selectedEmail?.relatedContactIds || selectedEmail.relatedContactIds.length === 0) return null;
    return query(collection(firestore, `organizations/${organizationId}/contacts`), where('__name__', 'in', selectedEmail.relatedContactIds));
  }, [firestore, organizationId, selectedEmail?.relatedContactIds]);
  const { data: linkedContacts, isLoading: isLoadingLinkedContacts } = useCollection<any>(linkedContactsQuery);
  
  const allContactsQuery = useMemoFirebase(() => (firestore && organizationId) ? collection(firestore, `organizations/${organizationId}/contacts`) : null, [firestore, organizationId]);
  const { data: allContacts, isLoading: loadingAllContacts } = useCollection<any>(allContactsQuery);
  const contactNameMap = React.useMemo(() => new Map(allContacts?.map(c => [c.id, `${c.firstName} ${c.lastName}`]) || []), [allContacts]);

  const linkedPropertyRef = useMemoFirebase(() => {
    if (!firestore || !organizationId || !selectedEmail?.relatedPropertyId) return null;
    return doc(firestore, `organizations/${organizationId}/properties`, selectedEmail.relatedPropertyId);
  }, [firestore, organizationId, selectedEmail?.relatedPropertyId]);
  const { data: linkedProperty, isLoading: isLoadingLinkedProperty } = useDoc<any>(linkedPropertyRef);

  const linkedTenancyRef = useMemoFirebase(() => {
    if (!firestore || !organizationId || !selectedEmail?.relatedTenancyId) return null;
    return doc(firestore, `organizations/${organizationId}/tenancies`, selectedEmail.relatedTenancyId);
  }, [firestore, organizationId, selectedEmail?.relatedTenancyId]);
  const { data: linkedTenancy, isLoading: isLoadingLinkedTenancy } = useDoc<any>(linkedTenancyRef);
  
  const suggestedContactQuery = useMemoFirebase(() => {
    if (!firestore || !organizationId || !selectedEmail?.fromAddress) return null;
    if (linkedContacts && linkedContacts.some(c => c.email === selectedEmail.fromAddress)) return null;
    return query(collection(firestore, `organizations/${organizationId}/contacts`), where('email', '==', selectedEmail.fromAddress), limit(1));
  }, [firestore, organizationId, selectedEmail?.fromAddress, linkedContacts]);
  const { data: suggestedContacts, isLoading: isLoadingSuggestedContacts } = useCollection<any>(suggestedContactQuery);
  const suggestedContact = (suggestedContacts && suggestedContacts.length > 0) ? suggestedContacts[0] : null;

  const suggestedPropertyFromAI = useMemo(() => {
    if (!aiSuggestions?.potentialPropertyName || !allProperties) return null;
    const searchString = aiSuggestions.potentialPropertyName.toLowerCase();
    return allProperties.find(p => p.addressLine1.toLowerCase().includes(searchString) || searchString.includes(p.addressLine1.toLowerCase()));
  }, [aiSuggestions, allProperties]);


  const getTimestampAsDate = (timestamp: any): Date => {
    if (!timestamp) return new Date();
    if (timestamp instanceof Timestamp) { return timestamp.toDate(); }
    if (typeof timestamp === 'string') { return new Date(timestamp); }
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
        if (selectedEmail.status === 'Received' && firestore && auth && organizationId) {
            const emailRef = doc(firestore, `organizations/${organizationId}/communications`, selectedEmail.id);
            updateDocumentNonBlocking(firestore, auth, organizationId, emailRef, { status: 'Read' }, selectedEmail.subject);
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
  }, [selectedEmail, firestore, auth, organizationId, organization?.aiEnabled]);


  const handleUpdateStatus = (status: 'Archived' | 'Trashed') => {
    if (!selectedEmail || !firestore || !auth || !organizationId) return;
    const emailRef = doc(firestore, `organizations/${organizationId}/communications`, selectedEmail.id);
    updateDocumentNonBlocking(firestore, auth, organizationId, emailRef, { status: status }, selectedEmail.subject);
    toast({ title: `Email moved to ${status === 'Trashed' ? 'trash' : 'archive'}` });
  }
  
  const handleMarkUnread = () => {
    if (!selectedEmail || !firestore || !auth || !organizationId || !emails) return;

    const currentIndex = emails.findIndex(e => e.id === selectedEmail.id);
    const nextIndex = currentIndex !== -1 && currentIndex < emails.length - 1 ? currentIndex + 1 : currentIndex - 1;
    const nextEmail = emails[nextIndex] || null;

    const emailRef = doc(firestore, `organizations/${organizationId}/communications`, selectedEmail.id);
    updateDocumentNonBlocking(firestore, auth, organizationId, emailRef, { status: 'Received' }, selectedEmail.subject);
    
    toast({ title: "Marked as unread" });
    setSelectedEmail(nextEmail);
  }

  const handleCreateTask = () => {
    if (!selectedEmail) return;
    setAddTaskDefaults({
      title: `Follow up on: ${selectedEmail.subject}`,
      description: `Task related to email from ${selectedEmail.fromAddress}.\n\n--- Email Body ---\n${selectedEmail.body}`,
      relatedCommunicationId: selectedEmail.id,
    });
    setAddTaskOpen(true);
  };

  const handleCreateMaintenanceTask = () => {
    if (!selectedEmail || !aiSuggestions) return;
    setAddTaskDefaults({
      title: `Maintenance: ${aiSuggestions.summary || selectedEmail.subject}`,
      description: `Task automatically suggested from email.\n\n--- Email Body ---\n${selectedEmail.body}`,
      relatedCommunicationId: selectedEmail.id,
      relatedPropertyId: suggestedPropertyFromAI?.id,
      priority: 'Medium',
    });
    setAddTaskOpen(true);
  };
  
  const handleLinkContact = (contactId: string) => {
    if (!selectedEmail || !firestore || !auth || !organizationId) return;
    const communicationRef = doc(firestore, `organizations/${organizationId}/communications`, selectedEmail.id);
    const updatedContactIds = Array.from(new Set([...(selectedEmail.relatedContactIds || []), contactId]));
    updateDocumentNonBlocking(firestore, auth, organizationId, communicationRef, { relatedContactIds: updatedContactIds }, selectedEmail.subject);
    toast({ title: 'Contact Linked', description: 'The contact has been successfully linked to this email.' });
  }

  const handleLinkProperty = (propertyId: string) => {
    if (!selectedEmail || !firestore || !auth || !organizationId) return;
    const communicationRef = doc(firestore, `organizations/${organizationId}/communications`, selectedEmail.id);
    updateDocumentNonBlocking(firestore, auth, organizationId, communicationRef, { relatedPropertyId: propertyId }, selectedEmail.subject);
    toast({ title: 'Property Linked', description: 'The property has been successfully linked to this email.' });
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

  const isRelatedLoading = isLoadingLinkedContacts || isLoadingLinkedProperty || isLoadingLinkedTenancy || isLoadingSuggestedContacts || (organization?.aiEnabled && isAnalyzing);
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
                                <p className={cn("font-semibold text-sm truncate", email.status === 'Received' && "font-bold")}>{email.fromAddress}</p>
                                <p className="text-xs text-muted-foreground">{formatDistanceToNow(getTimestampAsDate(email.timestamp), { addSuffix: true })}</p>
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
                                    <Tooltip><TooltipTrigger asChild>{selectedEmail ? <LinkEntityDialog communication={selectedEmail} /> : <Button variant="ghost" size="icon" disabled><LinkIcon className="h-4 w-4" /></Button>}</TooltipTrigger><TooltipContent>Link to Entity</TooltipContent></Tooltip>
                                    <Separator orientation="vertical" className="h-6 mx-1" />
                                    <Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon" onClick={() => handleUpdateStatus('Archived')} disabled={!selectedEmail || isLoading}><Archive className="h-4 w-4" /></Button></TooltipTrigger><TooltipContent>Archive</TooltipContent></Tooltip>
                                    <Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon" onClick={() => handleUpdateStatus('Trashed')} disabled={!selectedEmail || isLoading}><Trash2 className="h-4 w-4" /></Button></TooltipTrigger><TooltipContent>Delete</TooltipContent></Tooltip>
                                </TooltipProvider>
                            </div>
                        </div>
                        <Separator className="my-2" />
                        <div className="flex items-center gap-3 mt-4">
                            {isLoading ? <Skeleton className="h-10 w-10 rounded-full" /> : <Avatar><AvatarFallback>{selectedEmail?.fromAddress?.substring(0, 2).toUpperCase()}</AvatarFallback></Avatar>}
                            <div className="grid gap-0.5">
                                {isLoading ? (<><Skeleton className="h-4 w-32" /><Skeleton className="h-3 w-48" /></>) : (<><p className="font-semibold">{selectedEmail?.fromAddress}</p><p className="text-xs text-muted-foreground">To: {selectedEmail?.toAddresses?.join(', ')}</p></>)}
                            </div>
                        </div>
                        <div className="mt-4">
                            {isLoading ? <Skeleton className="h-6 w-3/4" /> : <h2 className="text-xl font-bold">{selectedEmail?.subject}</h2>}
                            {isLoading ? <Skeleton className="h-4 w-24 mt-1" /> : <p className="text-sm text-muted-foreground">{format(getTimestampAsDate(selectedEmail?.timestamp), 'PPP p')}</p>}
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
                           {linkedContacts?.map(contact => (<Badge key={contact.id} variant="zinc" className="font-normal"><User className="h-3 w-3 mr-1.5" /><Link href={`/contacts/${contact.id}`} className="hover:underline">{contact.firstName} {contact.lastName}</Link></Badge>))}
                           {linkedProperty && (<Badge variant="zinc" className="font-normal"><Home className="h-3 w-3 mr-1.5" /><Link href={`/properties/${linkedProperty.id}`} className="hover:underline">{linkedProperty.addressLine1}</Link></Badge>)}
                           {linkedTenancy && (<Badge variant="zinc" className="font-normal"><FileText className="h-3 w-3 mr-1.5" /><Link href={`/tenancies/${linkedTenancy.id}`} className="hover:underline">Tenancy Agreement</Link></Badge>)}
                           
                           {organization?.aiEnabled && (
                            <>
                                {suggestedContact && (<Badge variant="outline" className="font-normal border-dashed items-center"><Lightbulb className="h-3 w-3 mr-1.5 text-[var(--theme-warning)]" /><span>Suggestion: Link to {suggestedContact.firstName} {suggestedContact.lastName}</span><Button size="xs" variant="ghost" className="ml-2 h-auto px-1 py-0" onClick={() => handleLinkContact(suggestedContact.id)}>Link</Button></Badge>)}
                                
                                {suggestedPropertyFromAI && !linkedProperty && (
                                        <Badge variant="outline" className="font-normal border-dashed items-center"><Lightbulb className="h-3 w-3 mr-1.5 text-[var(--theme-warning)]" /><span>AI Suggestion: Link to {suggestedPropertyFromAI.addressLine1}</span><Button size="xs" variant="ghost" className="ml-2 h-auto px-1 py-0" onClick={() => handleLinkProperty(suggestedPropertyFromAI.id)}>Link</Button></Badge>
                                )}
                            </>
                           )}

                           {!isRelatedLoading && !linkedContacts?.length && !linkedProperty && !linkedTenancy && !suggestedContact && (<span className="text-sm text-muted-foreground">Not linked to any entities.</span>)}
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
                    <TableHeader><TableRow><TableHead>Contact(s)</TableHead><TableHead>Summary</TableHead><TableHead>Direction</TableHead><TableHead className="text-right">Date</TableHead></TableRow></TableHeader>
                    <TableBody>
                        {isLoading ? Array.from({length: 3}).map((_, i) => <TableRow key={i}><TableCell><Skeleton className="h-5 w-24" /></TableCell><TableCell><Skeleton className="h-5 w-48" /></TableCell><TableCell><Skeleton className="h-6 w-20" /></TableCell><TableCell><Skeleton className="h-5 w-24 ml-auto" /></TableCell></TableRow>) :
                        calls && calls.length > 0 ? calls.map(call => (
                            <TableRow key={call.id} className="cursor-pointer" onClick={() => setEditingLog(call)}>
                                <TableCell>{call.relatedContactIds?.map(id => contactNameMap.get(id)).join(', ') || 'N/A'}</TableCell>
                                <TableCell className="font-medium">{call.subject || 'No Subject'}</TableCell>
                                <TableCell><Badge variant={call.direction === 'Inbound' ? 'secondary' : 'default'}>{call.direction}</Badge></TableCell>
                                <TableCell className="text-right text-sm text-muted-foreground">{formatDistanceToNow(getTimestampAsDate(call.timestamp), { addSuffix: true })}</TableCell>
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
                    <TableHeader><TableRow><TableHead>Contact(s)</TableHead><TableHead>Summary</TableHead><TableHead>Direction</TableHead><TableHead className="text-right">Date</TableHead></TableRow></TableHeader>
                    <TableBody>
                        {isLoading ? Array.from({length: 3}).map((_, i) => <TableRow key={i}><TableCell><Skeleton className="h-5 w-24" /></TableCell><TableCell><Skeleton className="h-5 w-48" /></TableCell><TableCell><Skeleton className="h-6 w-20" /></TableCell><TableCell><Skeleton className="h-5 w-24 ml-auto" /></TableCell></TableRow>) :
                        whatsappMessages && whatsappMessages.length > 0 ? whatsappMessages.map(msg => (
                            <TableRow key={msg.id} className="cursor-pointer" onClick={() => setEditingLog(msg)}>
                                <TableCell>{msg.relatedContactIds?.map(id => contactNameMap.get(id)).join(', ') || 'N/A'}</TableCell>
                                <TableCell className="font-medium">{msg.subject || 'No Subject'}</TableCell>
                                <TableCell><Badge variant={msg.direction === 'Inbound' ? 'secondary' : 'default'}>{msg.direction}</Badge></TableCell>
                                <TableCell className="text-right text-sm text-muted-foreground">{formatDistanceToNow(getTimestampAsDate(msg.timestamp), { addSuffix: true })}</TableCell>
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
