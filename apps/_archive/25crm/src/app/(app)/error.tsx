'use client'
 
import { Button } from '@relentify/ui'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@relentify/ui'
import { useEffect } from 'react'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <div className="flex items-center justify-center p-4">
        <Card className="w-full max-w-lg text-center">
            <CardHeader>
                <CardTitle className="mt-4">Something went wrong!</CardTitle>
                <CardDescription>
                    An unexpected error occurred in this part of the application.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <div className="text-left bg-background/50 p-4 rounded-md border text-xs font-mono overflow-auto max-h-60">
                    <pre><code>{error.message}</code></pre>
                </div>
            </CardContent>
            <CardFooter className="flex justify-center">
                <Button onClick={() => reset()}>Try again</Button>
            </CardFooter>
        </Card>
    </div>
  )
}
