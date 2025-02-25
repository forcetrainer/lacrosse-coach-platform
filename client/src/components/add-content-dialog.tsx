import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, Share2 } from "lucide-react";
import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { apiRequest } from "@/lib/queryClient";
import { insertContentSchema, extractVideoInfo } from "@shared/schema";

const categories = [
  "Dodging",
  "Defense",
  "Shooting",
  "Passing",
  "Stick Skills",
  "Game Strategy",
];

function useShareTarget() {
  const [sharedUrl, setSharedUrl] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined' && window.location.hash.startsWith('#share=')) {
      const url = decodeURIComponent(window.location.hash.slice(7));
      setSharedUrl(url);
      // Clear the hash after reading
      window.history.replaceState(null, '', window.location.pathname);
    }
  }, []);

  return sharedUrl;
}

export default function AddContentDialog() {
  const [open, setOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const sharedUrl = useShareTarget();

  const form = useForm<z.infer<typeof insertContentSchema>>({
    resolver: zodResolver(insertContentSchema),
    defaultValues: {
      title: "",
      url: sharedUrl || "",
      category: "",
    },
  });

  // Watch URL changes to auto-detect platform
  const url = form.watch("url");
  useEffect(() => {
    if (url) {
      const { platform } = extractVideoInfo(url);
      if (platform !== 'Invalid URL') {
        toast({
          title: `${platform} link detected`,
          description: "URL validated successfully.",
        });
      }
    }
  }, [url, toast]);

  // Auto-open dialog when there's a shared URL
  useEffect(() => {
    if (sharedUrl) {
      setOpen(true);
    }
  }, [sharedUrl]);

  const mutation = useMutation({
    mutationFn: async (values: z.infer<typeof insertContentSchema>) => {
      const res = await apiRequest("POST", "/api/content", values);
      return res.json();
    },
    onSuccess: () => {
      setOpen(false);
      form.reset();
      queryClient.invalidateQueries({ queryKey: ["/api/content"] });
      toast({
        title: "Content added",
        description: "Your training content has been added successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error adding content",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Share2 className="h-4 w-4 mr-2" />
          Share Content
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Share Training Content</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit((data) => mutation.mutate(data))}
            className="space-y-4"
          >
            <FormField
              control={form.control}
              name="url"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Social Media URL</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="Paste YouTube, Instagram, TikTok, or Facebook URL" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Title</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="Give this content a descriptive title" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="category"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Category</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a category" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {categories.map((category) => (
                        <SelectItem key={category} value={category}>
                          {category}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit" className="w-full" disabled={mutation.isPending}>
              {mutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Share Content
            </Button>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}