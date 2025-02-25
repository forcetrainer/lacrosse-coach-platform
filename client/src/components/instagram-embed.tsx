import { useEffect, useRef } from "react";

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

  useEffect(() => {
    // Process embeds when the component mounts or URL changes
    if (window.instgrm) {
      window.instgrm.Embeds.process();
    }
  }, [url]);

  return (
    <div ref={containerRef} className="instagram-embed-container">
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
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              background: "#FFFFFF",
              lineHeight: 0,
              padding: "0 0",
              textAlign: "center",
              textDecoration: "none",
              width: "100%",
            }}
          >
            Loading Instagram content...
          </a>
        </div>
      </blockquote>
    </div>
  );
}
