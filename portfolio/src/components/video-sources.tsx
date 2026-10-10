import type { VideoMedia } from "@/lib/content";

/**
 * Deux encodages : H.264/MP4 (Safari, iOS, la plupart des navigateurs) puis
 * VP9/WebM (navigateurs sans H.264, et fichier plus léger). Le navigateur
 * prend la première source qu'il sait lire.
 */
export function VideoSources({ video }: { video: VideoMedia }) {
  return (
    <>
      <source src={video.src} type='video/mp4; codecs="avc1.42E01E"' />
      <source src={video.src.replace(/\.mp4$/, ".webm")} type='video/webm; codecs="vp9"' />
    </>
  );
}
