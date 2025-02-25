import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { ContentLink, Comment } from "@shared/schema";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, MessageSquare, Eye } from "lucide-react";
import { useState } from "react";
import { apiRequest } from "@/lib/queryClient";

interface ContentCardProps {
  content: ContentLink;
}

export default function ContentCard({ content }: ContentCardProps) {
  const [comment, setComment] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: comments } = useQuery<Comment[]>({
    queryKey: [`/api/content/${content.id}/comments`],
  });

  const { data: watchStatus } = useQuery({
    queryKey: [`/api/content/${content.id}/watch`],
  });

  const toggleWatchMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/content/${content.id}/watch`, {
        watched: !watchStatus?.watched,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/content/${content.id}/watch`] });
    },
  });

  const commentMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/content/${content.id}/comments`, {
        content: comment,
        contentId: content.id,
      });
      return res.json();
    },
    onSuccess: () => {
      setComment("");
      queryClient.invalidateQueries({ queryKey: [`/api/content/${content.id}/comments`] });
      toast({
        title: "Comment added",
        description: "Your comment has been added successfully.",
      });
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>{content.title}</span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => toggleWatchMutation.mutate()}
            className={watchStatus?.watched ? "text-green-600" : ""}
          >
            {watchStatus?.watched ? <Check className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </Button>
        </CardTitle>
        <div className="text-sm text-muted-foreground">Category: {content.category}</div>
      </CardHeader>
      <CardContent>
        <a
          href={content.url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-600 hover:underline break-all"
        >
          {content.url}
        </a>
        
        <div className="mt-4">
          <div className="flex items-center gap-2 mb-2">
            <MessageSquare className="h-4 w-4" />
            <span className="font-medium">Comments ({comments?.length || 0})</span>
          </div>
          <div className="space-y-2">
            {comments?.map((comment) => (
              <div key={comment.id} className="bg-muted p-2 rounded-md text-sm">
                {comment.content}
              </div>
            ))}
          </div>
        </div>
      </CardContent>
      <CardFooter>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            commentMutation.mutate();
          }}
          className="w-full space-y-2"
        >
          <Textarea
            placeholder="Add a comment..."
            value={comment}
            onChange={(e) => setComment(e.target.value)}
          />
          <Button
            type="submit"
            disabled={!comment.trim() || commentMutation.isPending}
            className="w-full"
          >
            Post Comment
          </Button>
        </form>
      </CardFooter>
    </Card>
  );
}
