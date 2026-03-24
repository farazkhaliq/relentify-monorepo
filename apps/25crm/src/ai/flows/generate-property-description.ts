'use server';

import { model } from '@/ai/genkit';

export interface GeneratePropertyDescriptionInput {
  propertyType: string;
  city: string;
  numberOfBedrooms: number;
  numberOfBathrooms: number;
  description?: string;
}

export async function generatePropertyDescription(input: GeneratePropertyDescriptionInput): Promise<string> {
  const prompt = `You are an expert real estate agent. Write a compelling and professional property description for a lettings advert.

Use the following details:
- Property Type: ${input.propertyType}
- Location: ${input.city}
- Bedrooms: ${input.numberOfBedrooms}
- Bathrooms: ${input.numberOfBathrooms}

${input.description ? `Incorporate the following key features or existing notes:\n${input.description}` : 'Be creative based on the property details.'}

The description should be engaging, highlight the best features of the property, and appeal to potential tenants. Do not include a title or any formatting other than paragraphs.`;

  const result = await model.generateContent(prompt);
  return result.response.text();
}
