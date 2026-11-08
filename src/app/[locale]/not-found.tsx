'use client'

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { ArrowLeft, Search } from "lucide-react"
import { useRouter } from "next/navigation"

export default function NotFound() {
  const router = useRouter()
  
  return (
    <div className="flex flex-col items-center justify-center min-h-[80vh] w-full">
      <Card className="max-w-md w-full mx-auto">
        <CardHeader>
          <div className="flex items-center gap-3 mb-2">
            <Search className="h-8 w-8 text-amber-500" />
            <CardTitle>Page introuvable</CardTitle>
          </div>
          <CardDescription>
            
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            Il s&apos;agit d&apos;une page introuvable, ou sans les droits nécessaires.
          </p>
        </CardContent>
        <CardFooter>
          <Button 
            onClick={() => router.push('/')}
            className="w-full"
            variant="default"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Retour à l&apos;accueil
          </Button>
        </CardFooter>
      </Card>
    </div>
  )
} 