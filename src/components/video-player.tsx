import { useState } from "react";
import { Play } from "lucide-react";

export type VideoPlatform = "youtube" | "instagram" | "tiktok" | "facebook" | "vimeo";

export function getVideoEmbed(url: string): { platform: VideoPlatform; src: string } | null {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.replace(/^www\./, "").toLowerCase();

    if (host === "youtu.be" || host.endsWith("youtube.com")) {
      const id = host === "youtu.be"
        ? parsed.pathname.split("/").filter(Boolean)[0]
        : parsed.searchParams.get("v") || parsed.pathname.match(/\/(?:embed|shorts|live)\/([^/?]+)/)?.[1];
      return id ? { platform: "youtube", src: `https://www.youtube-nocookie.com/embed/${encodeURIComponent(id)}` } : null;
    }
    if (host.endsWith("instagram.com")) {
      const match = parsed.pathname.match(/\/(?:p|reel|reels|tv)\/([^/]+)/);
      return match ? { platform: "instagram", src: `https://www.instagram.com/${match[0]}/embed` } : null;
    }
    if (host.endsWith("tiktok.com")) {
      const id = parsed.pathname.match(/\/video\/(\d+)/)?.[1];
      return id ? { platform: "tiktok", src: `https://www.tiktok.com/player/v1/${id}?music_info=1&description=1` } : null;
    }
    if (host.endsWith("facebook.com") || host === "fb.watch") {
      return { platform: "facebook", src: `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(url)}&show_text=false&width=560` };
    }
    if (host.endsWith("vimeo.com")) {
      const id = parsed.pathname.match(/\/(\d+)/)?.[1];
      return id ? { platform: "vimeo", src: `https://player.vimeo.com/video/${id}` } : null;
    }
    return null;
  } catch {
    return null;
  }
}

export function VideoPlayer({ url, title }: { url: string; title: string }) {
  const [erro, setErro] = useState(false);
  const embed = getVideoEmbed(url);
  const arquivoDireto = /\\.(mp4|webm|mov|ogg)(?:$|[?#])/i.test(url);
  if (arquivoDireto) {
    return (
      <div className="relative aspect-video overflow-hidden rounded-t-2xl bg-black">
        <video src={url} title={title} controls playsInline preload="metadata" className="h-full w-full object-contain" />
      </div>
    );
  }
  if (!embed) {
    return <div className="flex aspect-video items-center justify-center bg-muted p-5 text-center text-sm text-muted-foreground">Este link não é de uma plataforma compatível ou não contém um vídeo público.</div>;
  }

  return (
    <div className="relative aspect-video overflow-hidden rounded-t-2xl bg-black">
      {!erro ? (
        <iframe
          src={embed.src}
          title={title}
          className="absolute inset-0 h-full w-full"
          loading="lazy"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
          referrerPolicy="strict-origin-when-cross-origin"
          onError={() => setErro(true)}
        />
      ) : (
        <a href={url} target="_blank" rel="noopener noreferrer" className="flex h-full items-center justify-center gap-2 text-sm text-white underline">
          <Play className="h-5 w-5" /> Abrir vídeo na rede social
        </a>
      )}
    </div>
  );
}
