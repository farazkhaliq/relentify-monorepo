'use client'
 
import { Button } from '@relentify/ui'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@relentify/ui'
import { FirestorePermissionError } from '@/firebase/errors'
import { ShieldAlert } from 'lucide-react'
import { useEffect } from 'react'
 
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // Log the error to an error reporting service
    console.error(error)
  }, [error])

  const isPermissionError = error instanceof FirestorePermissionError || error.name === 'FirebaseError';
 
  return (
    <html>
      <body>
        <div className="flex min-h-screen items-center justify-center bg-muted/40 p-4">
            <Card className="w-full max-w-lg text-center">
                <CardHeader>
                    {isPermissionError && (
                        <div className="mx-auto bg-destructive/10 text-destructive p-3 rounded-full w-fit">
                           <ShieldAlert className="h-8 w-8" />
                        </div>
                    )}
                    <CardTitle className="mt-4">{isPermissionError ? "Permission Denied" : "Something went wrong!"}</CardTitle>
                    <CardDescription>
                        {isPermissionError
                            ? "You do not have permission to perform this action or access this resource. Please check your security rules."
                            : "An unexpected error occurred. You can try to refresh the page or contact support."
                        }
                    </CardDescription>
                </CardHeader>
                {isPermissionError && (
                    <CardContent>
                        <div className="text-left bg-background/50 p-4 rounded-md border text-xs font-mono overflow-auto max-h-60">
                           <pre><code>{error.message}</code></pre>
                        </div>
                    </CardContent>
                )}
                <CardFooter className="flex justify-center">
                    <Button onClick={() => reset()}>Try again</Button>
                </CardFooter>
            </Card>
        </div>
      </body>
    </html>
  )
}
