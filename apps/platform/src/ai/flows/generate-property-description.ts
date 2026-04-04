// Stub — Gemini dependency removed. Returns a basic template description.
// To enable AI descriptions, configure AI_DEFAULT_API_URL + AI_DEFAULT_API_KEY env vars.

export async function generatePropertyDescription(input: {
  propertyType?: string
  bedrooms?: number
  bathrooms?: number
  address?: string
  features?: string[]
}): Promise<string> {
  const { propertyType, bedrooms, bathrooms, address, features } = input

  // If AI env vars are configured, use them
  const apiUrl = process.env.AI_DEFAULT_API_URL
  const apiKey = process.env.AI_DEFAULT_API_KEY

  if (apiUrl && apiKey) {
    try {
      const prompt = `Write a concise, professional property listing description for a ${bedrooms || '?'}-bedroom ${propertyType || 'property'} at ${address || 'undisclosed location'}. ${features?.length ? 'Features: ' + features.join(', ') + '.' : ''} Keep it under 150 words.`

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
        body: JSON.stringify({
          model: process.env.AI_DEFAULT_MODEL || 'gpt-4o-mini',
          messages: [{ role: 'user', content: prompt }],
          max_tokens: 300,
        }),
      })

      if (response.ok) {
        const data = await response.json()
        return data.choices?.[0]?.message?.content || fallbackDescription(input)
      }
    } catch {}
  }

  return fallbackDescription(input)
}

function fallbackDescription(input: any): string {
  const parts = []
  if (input.propertyType) parts.push(`A ${input.propertyType.toLowerCase()}`)
  if (input.bedrooms) parts.push(`with ${input.bedrooms} bedroom${input.bedrooms > 1 ? 's' : ''}`)
  if (input.bathrooms) parts.push(`and ${input.bathrooms} bathroom${input.bathrooms > 1 ? 's' : ''}`)
  if (input.address) parts.push(`located at ${input.address}`)
  return parts.length > 0 ? parts.join(' ') + '.' : 'Property description pending.'
}
