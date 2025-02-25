import { useEffect, useRef, useState } from "react";

interface InstagramEmbedProps {
  url: string;
}

declare global {
  interface Window {
    instgrm?: {
      Embeds: {
        process(): void;
      };
    };
  }
}

export default function InstagramEmbed({ url }: InstagramEmbedProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let attempts = 0;
    const maxAttempts = 10;
    const interval = 1000; // 1 second

    const processEmbed = () => {
      if (window.instgrm) {
        window.instgrm.Embeds.process();
        setIsLoading(false);
        return true;
      }
      return false;
    };

    // Try to process immediately if script is already loaded
    if (!processEmbed() && attempts < maxAttempts) {
      // If not loaded, try again periodically
      const timer = setInterval(() => {
        attempts++;
        if (processEmbed() || attempts >= maxAttempts) {
          clearInterval(timer);
        }
      }, interval);

      return () => clearInterval(timer);
    }
  }, [url]);

  return (
    <div ref={containerRef} className="instagram-embed-container w-full max-w-[550px] mx-auto">
      <blockquote
        className="instagram-media"
        data-instgrm-permalink={url}
        data-instgrm-version="14"
        style={{
          background: "#FFF",
          border: 0,
          borderRadius: "3px",
          boxShadow: "0 0 1px 0 rgba(0,0,0,0.5),0 1px 10px 0 rgba(0,0,0,0.15)",
          margin: "1px",
          maxWidth: "540px",
          minWidth: "326px",
          padding: 0,
          width: "calc(100% - 2px)",
        }}
      >
        <div style={{ padding: "16px" }}>
          {isLoading ? (
            <div className="flex items-center justify-center p-8 text-muted-foreground">
              Loading Instagram content...
            </div>
          ) : null}
        </div>
      </blockquote>
    </div>
  );
}