import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { ContentLink, Comment, extractVideoInfo } from "@shared/schema";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, MessageSquare, Eye, PlayCircle, Trash2 } from "lucide-react";
import { SiYoutube, SiInstagram, SiTiktok, SiFacebook } from "react-icons/si";
import { useState } from "react";
import { apiRequest } from "@/lib/queryClient";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useAuth } from "@/hooks/use-auth";

interface ContentCardProps {
  content: ContentLink;
}

function PlatformIcon({ url }: { url: string }) {
  const { platform } = extractVideoInfo(url);
  const iconClass = "h-5 w-5";

  switch (platform) {
    case 'YouTube':
      return <SiYoutube className={`${iconClass} text-red-600`} />;
    case 'Instagram':
      return <SiInstagram className={`${iconClass} text-pink-600`} />;
    case 'TikTok':
      return <SiTiktok className={`${iconClass} text-black`} />;
    case 'Facebook':
      return <SiFacebook className={`${iconClass} text-blue-600`} />;
    default:
      return null;
  }
}

export default function ContentCard({ content }: ContentCardProps) {
  const [comment, setComment] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { platform } = extractVideoInfo(content.url);
  const { user } = useAuth();
  const isYouTube = platform === 'YouTube';

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
      toast({
        title: watchStatus?.watched ? "Marked as unwatched" : "Marked as watched",
        description: "Your watch status has been updated.",
      });
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

  const deleteMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("DELETE", `/api/content/${content.id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/content"] });
      toast({
        title: "Content deleted",
        description: "The content has been removed successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error deleting content",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <PlatformIcon url={content.url} />
            <span>{content.title}</span>
          </div>
          <div className="flex items-center gap-2">
            {user?.isCoach && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="ghost" size="sm">
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete Content</AlertDialogTitle>
                    <AlertDialogDescription>
                      Are you sure you want to delete "{content.title}"? This action cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={() => deleteMutation.mutate()}>
                      Delete
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => toggleWatchMutation.mutate()}
              className={watchStatus?.watched ? "text-green-600" : ""}
            >
              {watchStatus?.watched ? <Check className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </Button>
          </div>
        </CardTitle>
        <div className="text-sm text-muted-foreground">Category: {content.category}</div>
      </CardHeader>
      <CardContent>
        <a
          href={content.url}
          target="_blank"
          rel="noopener noreferrer"
          className="relative block aspect-video w-full overflow-hidden rounded-lg mb-4 group"
        >
          {isYouTube ? (
            <img
              src={content.thumbnailUrl}
              alt={content.title}
              className="w-full h-full object-cover transition-transform group-hover:scale-105"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gray-100 group-hover:bg-gray-200 transition-colors">
              <img
                src={content.thumbnailUrl}
                alt={`${platform} content`}
                className="h-16 w-16 object-contain"
              />
            </div>
          )}
          <div className="absolute inset-0 bg-black/20 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
            <PlayCircle className="w-12 h-12 text-white" />
          </div>
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