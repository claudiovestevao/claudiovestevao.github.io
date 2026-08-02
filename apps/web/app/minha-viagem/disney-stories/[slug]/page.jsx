import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Headphones, Info, Music2 } from "lucide-react";
import { readDisneyStoryEpisode } from "../../api/_lib/disney-stories";
import { spotifyEpisodeEmbedUrl } from "../../api/_lib/disney-stories-core";
import "./story.css";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const result = await readDisneyStoryEpisode(slug);
  if (!result.episode) return { title: "História da Luiza | Minha Viagem" };
  return {
    title: `${displayName(result.episode.character)} | Histórias da Luiza`,
    description: result.episode.description,
    openGraph: {
      title: result.episode.title,
      description: result.episode.description,
      images: result.episode.imageUrl ? [{ url: result.episode.imageUrl }] : []
    }
  };
}

export default async function DisneyStoryPage({ params }) {
  const { slug } = await params;
  const result = await readDisneyStoryEpisode(slug);
  if (!result.episode) notFound();

  const episode = result.episode;
  const spotifyEmbed = spotifyEpisodeEmbedUrl(episode);
  const paragraphs = episode.script.split(/\n{2,}/).map((part) => part.trim()).filter(Boolean);

  return (
    <main className="story-page">
      <section className="story-shell">
        <nav className="story-nav">
          <Link href="/minha-viagem">
            <ArrowLeft size={17} />
            Minha Viagem
          </Link>
          <span>Histórias da Luiza</span>
        </nav>

        <header className="story-hero">
          <div className="story-cover-wrap">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="story-cover" src={episode.imageUrl} alt={`Capa da história ${displayName(episode.character)}`} />
          </div>
          <div className="story-copy">
            <span className="story-date">{formatDateBr(episode.date)}</span>
            <h1>{displayName(episode.character)}</h1>
            <p>{episode.description}</p>
            <div className="story-actions">
              <a href={episode.audioUrl}>
                <Headphones size={18} />
                Áudio direto
              </a>
              <a href="/minha-viagem/disney-stories/rss.xml">
                <Music2 size={18} />
                RSS do podcast
              </a>
            </div>
          </div>
        </header>

        {episode.originNote ? (
          <section className="story-origin" aria-label="Curiosidade do personagem">
            <Info size={18} />
            <div>
              <h2>Conhecendo o personagem</h2>
              <p>{episode.originNote}</p>
            </div>
          </section>
        ) : null}

        <section className="story-player" aria-label="Reprodução da história">
          {spotifyEmbed ? (
            <iframe
              allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
              loading="lazy"
              src={spotifyEmbed}
              title={`Spotify - ${episode.title}`}
            />
          ) : (
            <div className="story-local-player">
              <span>Spotify entra aqui quando o episódio aparecer no feed.</span>
              <audio controls preload="metadata" src={episode.audioUrl}>
                Seu navegador não conseguiu reproduzir este áudio.
              </audio>
            </div>
          )}
        </section>

        <article className="story-script">
          <h2>Historinha do dia</h2>
          {paragraphs.map((paragraph) => (
            <p key={paragraph}>{paragraph}</p>
          ))}
        </article>

        {episode.disclaimer ? <p className="story-disclaimer">{episode.disclaimer}</p> : null}
      </section>
    </main>
  );
}

function formatDateBr(iso) {
  const [year, month, day] = String(iso).split("-");
  return `${day}/${month}/${year}`;
}

function displayName(name) {
  return name === "Goofy" ? "Pateta" : name === "Tinker Bell" ? "Sininho" : name;
}
