"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { Button } from "@/components/ui/button"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { authClient } from "@lib/auth-client"
import { toast } from "sonner"
import { useState } from "react"
import { Loader2 } from "lucide-react"

const formSchema = z.object({
  name: z.string().min(2).max(50),
  slug: z.string().min(2).max(50)
})

export function CreateOrganizationForm() {
    const [isLoading, setIsLoading] = useState(false)
    const form = useForm<z.infer<typeof formSchema>>({
      resolver: zodResolver(formSchema),
      defaultValues: {
        name: "",
        slug: ""
      },
    })
   
    async function onSubmit(values: z.infer<typeof formSchema>) {
        try{
            setIsLoading(true)
            await authClient.organization.create({
                name: values.name, 
                slug: values.slug, 
                logo: "https://example.com/logo.png",
            });

            toast.success("Organization created successfully!")
        }
        catch(err){
            console.log(err)
            toast.error("Failed to create an organization!")
        }
        finally{
            setIsLoading(false);
        }
    }

    return (
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input placeholder="My Organization" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="slug"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Slug</FormLabel>
                  <FormControl>
                    <Input placeholder="my-organization" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? <Loader2 className="size-4 animate-spin"/> : "Create Organization"}
            </Button>
          </form>
        </Form>
      )
}