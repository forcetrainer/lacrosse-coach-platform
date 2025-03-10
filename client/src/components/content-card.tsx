import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { ContentLink, Comment, extractVideoInfo } from "@shared/schema";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, MessageSquare, Eye, PlayCircle, Trash2, ChevronDown, ChevronUp, ThumbsUp } from "lucide-react";
import { SiYoutube, SiInstagram, SiTiktok, SiFacebook } from "react-icons/si";
import { useState } from "react";
import { formatDistanceToNow } from "date-fns";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface ContentCardProps {
  content: ContentLink & {
    watchers?: { username: string; watched: boolean }[];
  };
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
  const [showAllComments, setShowAllComments] = useState(false);
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'likes'>('newest');
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { platform } = extractVideoInfo(content.url);
  const { user } = useAuth();

  const { data: comments = [] } = useQuery<(Comment & { username: string; likeCount: number; hasLiked?: boolean })[]>({
    queryKey: [`/api/content/${content.id}/comments`, sortBy],
    queryFn: () => apiRequest("GET", `/api/content/${content.id}/comments?sortBy=${sortBy}`).then(res => res.json())
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
      queryClient.invalidateQueries({ queryKey: ["/api/content"] });
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

  const viewMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", `/api/content/${content.id}/view`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/content"] });
      queryClient.invalidateQueries({ queryKey: [`/api/content/${content.id}/watch`] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error tracking view",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const likeMutation = useMutation({
    mutationFn: async (commentId: number) => {
      await apiRequest("POST", `/api/comments/${commentId}/like`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/content/${content.id}/comments`] });
    }
  });

  const unlikeMutation = useMutation({
    mutationFn: async (commentId: number) => {
      await apiRequest("POST", `/api/comments/${commentId}/unlike`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/content/${content.id}/comments`] });
    }
  });

  const { data: watchStatus } = useQuery({
    queryKey: [`/api/content/${content.id}/watch`],
    enabled: !user?.isCoach && !!user, // Only fetch watch status for non-coach users who are logged in
  });

  // Debug logging
  console.log('Watch status for content', content.id, ':', watchStatus);
  console.log('User:', user);

  // Video is only watched if we have an explicit record with watched=true
  const isWatched = watchStatus?.watched === true;

  const handleContentClick = () => {
    // First mark the video as viewed
    viewMutation.mutate();

    // Then update watch status to watched
    if (!user?.isCoach) {
      toggleWatchMutation.mutate();
    }

    // Open the video in a new tab
    window.open(content.url, '_blank');
  };

  const formatCommentDate = (date: string) => {
    return formatDistanceToNow(new Date(date), { addSuffix: true });
  };

  const visibleComments = showAllComments ? comments : comments.slice(0, 1);
  const hasMoreComments = comments.length > 1;


  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <PlatformIcon url={content.url} />
            <span>{content.title}</span>
          </div>
          <div className="flex items-center gap-2">
            {!user?.isCoach && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => toggleWatchMutation.mutate()}
                className={isWatched ? "text-green-600" : ""}
              >
                {isWatched ? <Check className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            )}
          </div>
        </CardTitle>
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>Category: {content.category}</span>
          <div className="flex items-center gap-4">
            {!user?.isCoach && (
              <span>{isWatched ? "Watched" : "Not watched"}</span>
            )}
            <span>{content.views} views</span>
          </div>
        </div>
        {user?.isCoach && content.watchers && content.watchers.length > 0 && (
          <div className="mt-2 text-sm">
            <p className="font-medium mb-1">Viewed by:</p>
            <div className="flex flex-wrap gap-1">
              {content.watchers.map((watcher) => (
                <span
                  key={watcher.username}
                  className={`px-2 py-1 rounded-full text-xs ${
                    watcher.watched
                      ? "bg-green-100 text-green-700"
                      : "bg-gray-100 text-gray-700"
                  }`}
                >
                  {watcher.username}
                </span>
              ))}
            </div>
          </div>
        )}
      </CardHeader>
      <CardContent>
        <a
          href="#"
          onClick={(e) => {
            e.preventDefault();
            handleContentClick();
          }}
          className="relative block aspect-video w-full overflow-hidden rounded-lg mb-4 group"
        >
          <div className="w-full h-full flex flex-col items-center justify-center bg-gray-100 group-hover:bg-gray-200 transition-colors">
            <PlatformIcon url={content.url} />
            <p className="mt-2 text-sm text-muted-foreground">Click to view on {platform}</p>
          </div>
          <div className="absolute inset-0 bg-black/20 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
            <PlayCircle className="w-12 h-12 text-white" />
          </div>
        </a>

        {content.description && (
          <div className="mb-4 p-4 bg-muted rounded-lg">
            <h4 className="font-medium mb-2">Coach's Notes:</h4>
            <p className="text-sm whitespace-pre-wrap">{content.description}</p>
          </div>
        )}

        <div className="mt-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4" />
              <span className="font-medium">Comments ({comments.length})</span>
            </div>
            <Select
              value={sortBy}
              onValueChange={(value: 'newest' | 'oldest' | 'likes') => setSortBy(value)}
            >
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Sort by..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="newest">Newest first</SelectItem>
                <SelectItem value="oldest">Oldest first</SelectItem>
                <SelectItem value="likes">Most liked</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            {comments.map((comment) => (
              <div key={comment.id} className="bg-muted p-3 rounded-md">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-medium text-sm">{comment.username}</span>
                  <span className="text-xs text-muted-foreground">
                    {formatCommentDate(comment.createdAt)}
                  </span>
                </div>
                <p className="text-sm">{comment.content}</p>
                <div className="flex items-center justify-between mt-2">
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={comment.userId === user?.id || likeMutation.isPending || unlikeMutation.isPending}
                      onClick={() => {
                        if (comment.hasLiked) {
                          unlikeMutation.mutate(comment.id);
                        } else {
                          likeMutation.mutate(comment.id);
                        }
                      }}
                    >
                      {comment.hasLiked ? (
                        <ThumbsUp className="h-4 w-4 fill-current text-primary" />
                      ) : (
                        <ThumbsUp className="h-4 w-4" />
                      )}
                      <span className="ml-1">{comment.likeCount}</span>
                    </Button>
                  </div>
                </div>
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