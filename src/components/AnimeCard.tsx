import Link from "next/link";

interface AnimeCardProps {
    id: string;
    title: string;
    image?: string;
    type?: string;
}

export default function AnimeCard({ id, title, image, type }: AnimeCardProps) {
    return (
        <Link href={`/anime/details?id=${encodeURIComponent(id)}`} style={{ textDecoration: "none" }}>
            <div className="manga-card" style={{
                background: "rgba(88, 101, 242, 0.03)",
                borderColor: "rgba(88, 101, 242, 0.15)"
            }}>
                <div className="manga-cover">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                        src={image || "/sakura.png"}
                        alt={title}
                        loading="lazy"
                    />
                    <div className="manga-badges" style={{ left: 8, top: 8, right: "auto" }}>
                        <span className="badge follows" style={{ background: "rgba(88, 101, 242, 0.9)" }}>
                            ▶ {type || "TV"}
                        </span>
                    </div>
                </div>
                <div className="manga-info">
                    <h3 className="manga-title" style={{ color: "#fff" }}>{title}</h3>
                </div>
            </div>
        </Link>
    );
}
