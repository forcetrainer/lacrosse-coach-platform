import { useAuth } from "@/hooks/use-auth";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { ContentLink } from "@shared/schema";
import ContentCard from "@/components/content-card";
import AddContentDialog from "@/components/add-content-dialog";
import { LogOut } from "lucide-react";
import { Loader2 } from "lucide-react";
import { Link } from "wouter";

type ContentWithWatchers = ContentLink & {
  watchers?: { username: string; watched: boolean }[];
};

export default function HomePage() {
  const { user, logoutMutation } = useAuth();

  const { data: content, isLoading } = useQuery<ContentWithWatchers[]>({
    queryKey: ["/api/content", user?.isCoach],
  });

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-primary">SkillReel</h1>
          <div className="flex items-center gap-4">
            <span>Welcome, {user?.username}</span>
            {user?.isCoach && (
              <>
                <AddContentDialog />
                <Button variant="outline" size="sm" asChild>
                  <Link href="/analytics">Analytics</Link>
                </Button>
              </>
            )}
            <Button variant="outline" size="sm" onClick={() => logoutMutation.mutate()} disabled={logoutMutation.isPending}>
              {logoutMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogOut className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {isLoading ? (
          <div className="flex justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : content?.length === 0 ? (
          <div className="text-center py-12">
            <h2 className="text-xl font-semibold mb-2">No content yet</h2>
            <p className="text-muted-foreground">
              {user?.isCoach
                ? "Start by adding some training content for your players."
                : "Check back later for training content from your coaches."}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {content?.map((item) => (
              <ContentCard key={item.id} content={item} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}