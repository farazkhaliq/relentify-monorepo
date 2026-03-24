'use server';

import { model } from '@/ai/genkit';

export interface AnalyzeCommunicationInput {
  subject?: string;
  body?: string;
}

export interface AnalyzeCommunicationOutput {
  isReplyOrForward: boolean;
  summary: string;
  potentialContactName?: string;
  potentialPropertyName?: string;
  suggestedCategory: 'Maintenance' | 'New Enquiry' | 'Payment' | 'General';
  suggestedAction: 'Create Maintenance Task' | 'Create Follow-up Task' | 'Archive' | 'None';
}

export async function analyzeCommunication(input: AnalyzeCommunicationInput): Promise<AnalyzeCommunicationOutput> {
  const prompt = `You are an expert assistant for a property management CRM. Analyze the following email content.

Subject: ${input.subject ?? ''}
Body:
${input.body ?? ''}

Based on the content, return a JSON object with exactly these fields:
- isReplyOrForward (boolean): true if subject starts with Re: or Fwd:
- summary (string): a one-sentence summary of the email's purpose
- potentialContactName (string, optional): a person's full name mentioned in the body who is likely a tenant or landlord — do NOT extract from signatures
- potentialPropertyName (string, optional): a property address or name mentioned in the email body
- suggestedCategory (string): one of exactly: "Maintenance", "New Enquiry", "Payment", "General"
- suggestedAction (string): one of exactly: "Create Maintenance Task", "Create Follow-up Task", "Archive", "None"
  - "Create Maintenance Task" if reporting a problem (leak, broken appliance, etc.)
  - "Create Follow-up Task" if it's a new enquiry or requires a response
  - "Archive" if purely informational, no action needed
  - "None" if unsure

Return only valid JSON, no markdown.`;

  const result = await model.generateContent({
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: { responseMimeType: 'application/json' },
  });

  return JSON.parse(result.response.text()) as AnalyzeCommunicationOutput;
}
