import Link from "next/link";

interface AnimeCardProps {
    id: string;
    title: string;
    image?: string;
    type?: string;
}

export default function AnimeCard({ id, title, image, type }: AnimeCardProps) {
    return (
        <Link href={`/anime/details?id=${encodeURIComponent(id)}`} className="manga-card">
            <div className="manga-card-cover">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                    src={image || "/sakura.png"}
                    alt={title}
                    loading="lazy"
                    decoding="async"
                    referrerPolicy="no-referrer"
                />
                <div className="manga-card-badge">
                    <span>▶ {type || "TV"}</span>
                </div>
            </div>
            <div className="manga-card-info">
                <h3 className="manga-card-title">{title}</h3>
            </div>
        </Link>
    );
}
