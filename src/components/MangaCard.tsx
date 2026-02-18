import Link from "next/link";

interface MangaCardProps {
    slug: string;
    title: string;
    cover: string;
    genres: string[];
    chapterCount: number;
    latestChapter?: number;
}

export default function MangaCard({
    slug,
    title,
    cover,
    genres,
    chapterCount,
    latestChapter,
    follows,
    rating,
    source
}: {
    slug: string,
    title: string,
    cover: string,
    genres: string[],
    chapterCount?: number,
    latestChapter?: number,
    follows?: number,
    rating?: number,
    source?: string
}) {
    return (
        <Link href={`/title?id=${slug}&source=${source || 'weebcentral'}`} className="manga-card">
            <div className="manga-card-cover">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={cover} alt={title} loading="lazy" />
                <div className="manga-card-badge">
                    {source && source !== 'weebcentral' && (
                        <span style={{ background: "var(--purple-accent)", marginRight: 4 }}>{source}</span>
                    )}
                    {follows ? (
                        <span>♥ {follows.toLocaleString()}</span>
                    ) : chapterCount ? (
                        <span>{chapterCount} chapters</span>
                    ) : null}
                </div>
            </div>
            <div className="manga-card-info">
                <h3 className="manga-card-title">{title}</h3>
                <div className="manga-card-meta">
                    {rating && (
                        <span style={{ color: "var(--gold)", fontWeight: "bold", marginRight: 8 }}>
                            ★ {rating.toFixed(1)}
                        </span>
                    )}
                    {genres.slice(0, 3).map((g) => (
                        <span key={g} className="manga-card-genre">{g}</span>
                    ))}
                </div>
            </div>
        </Link>
    );
}
