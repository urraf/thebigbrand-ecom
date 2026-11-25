"use client";
import Image from "next/image";
import { useRef, useState, type CSSProperties, type ReactNode } from "react";
import type { ImageLite, ProductCardData } from "@/types/shared";
import { useStore } from "@/components/cart/cart-context";
import { Packshot } from "@/components/ui/packshot";
import { Icon } from "@/components/ui/icon";
import { cx } from "@/components/ui/cx";
import { toast } from "@/components/ui/toast";
import { productTint } from "@/components/ui/product-image";

/**
 * PDP gallery (port of the demo's gallery): thumbnails + stage + hover zoom (lens over the image, magnified
 * pane over the info column on wide screens) + swipe on touch. Views: every ProductImage, then a close-up,
 * the key ingredients and "in the box" (with the free TBB mini) built from the real product data. Products
 * without photos use the SVG packshot for every view.
 */

type View = { key: string; label: string; kind: "photo" | "close" | "ing" | "box"; image: ImageLite | null };
export type GalleryProps = {
  product: ProductCardData;
  images: ImageLite[];
  badge: string | null;
  ingredients: { name: string; color: string }[];
  gift: ProductCardData | null;
  title: string;
};

const ZOOM = 2.2;
const OPT = /^(\/(?!\/)|https:\/\/[a-z0-9-]+\.public\.blob\.vercel-storage\.com\/)/i;

function Visual({ product, image, sizes, priority, alt }: { product: ProductCardData; image: ImageLite | null; sizes: string; priority?: boolean; alt: string }) {
  if (image?.url)
    return (
      <Image
        src={image.url}
        alt={alt}
        fill
        sizes={sizes}
        className="pd-img"
        loading={priority ? "eager" : undefined}
        fetchPriority={priority ? "high" : undefined}
        unoptimized={!OPT.test(image.url)}
      />
    );
  return <Packshot art={product.art} name={product.name} brand={product.brand} isOwnLabel={product.isOwnLabel} labelled={false} />;
}

function ViewBody({ v, p, ingredients, gift, sizes, priority, title }: { v: View; p: ProductCardData; ingredients: GalleryProps["ingredients"]; gift: ProductCardData | null; sizes: string; priority?: boolean; title: string }) {
  const vis = (cls: string, alt = title) => (
    <span className={cx("pd-a", cls)}>
      <Visual product={p} image={v.image} sizes={sizes} priority={priority} alt={alt} />
    </span>
  );
  let body: ReactNode;
  switch (v.kind) {
    case "close":
      body = (
        <div className="pd-v pd-v-close">
          {vis("pd-a-close", `${title} — close-up`)}
          <span className="pd-v-cap">Close-up</span>
        </div>
      );
      break;
    case "ing":
      body = (
        <div className="pd-v pd-v-ing">
          {vis("pd-a-left", `${title} — key ingredients`)}
          <ul className="pd-v-list">
            {ingredients.slice(0, 4).map((i) => (
              <li key={i.name} style={{ "--c": i.color } as CSSProperties}>
                <i />
                <span>
                  <b>{i.name}</b>
                </span>
              </li>
            ))}
          </ul>
          <span className="pd-v-cap">Key ingredients</span>
        </div>
      );
      break;
    case "box":
      body = (
        <div className="pd-v pd-v-box">
          {vis("pd-a-boxp", `${title} with a free TBB gift`)}
          {gift ? (
            <span className="pd-a pd-a-gift">
              <Visual product={gift} image={gift.image} sizes="120px" alt="" />
            </span>
          ) : null}
          <span className="pd-giftbox" aria-hidden="true">
            <svg viewBox="0 0 120 100">
              <rect x="10" y="38" width="100" height="58" rx="8" fill="#ff3d6e" />
              <rect x="4" y="26" width="112" height="18" rx="6" fill="#ff6a8e" />
              <rect x="52" y="26" width="16" height="70" fill="#ffcf5a" />
              <path d="M60 26c-10-22-34-18-28-4 4 8 18 6 28 4zm0 0c10-22 34-18 28-4-4 8-18 6-28 4z" fill="#ffcf5a" />
              <text x="60" y="76" textAnchor="middle" fontSize="13" fontWeight="800" fill="#fff" fontFamily="system-ui">FREE</text>
            </svg>
          </span>
          <span className="pd-v-cap">Free TBB gift in the box</span>
        </div>
      );
      break;
    default:
      body = <div className="pd-v pd-v-front">{vis("pd-a-main")}</div>;
  }
  return body;
}

export function Gallery({ product: p, images, badge, ingredients, gift, title }: GalleryProps) {
  const { isWished, toggleWish } = useStore();
  const wished = isWished(p.id);
  const views: View[] = [
    ...(images.length ? images.map((img, i): View => ({ key: `img-${i}`, label: img.alt || `Image ${i + 1}`, kind: "photo", image: img })) : [{ key: "pk", label: "Front", kind: "photo" as const, image: null }]),
    { key: "close", label: "Close-up", kind: "close", image: images[0] ?? null },
    ...(ingredients.length >= 2 ? [{ key: "ing", label: "Key ingredients", kind: "ing" as const, image: images[0] ?? null }] : []),
    { key: "box", label: "In the box", kind: "box", image: images[0] ?? null },
  ];
  const [cur, setCur] = useState(0);
  const [zoom, setZoom] = useState<{ w: number; h: number } | null>(null);
  const stage = useRef<HTMLDivElement>(null);
  const lens = useRef<HTMLSpanElement>(null);
  const zin = useRef<HTMLDivElement>(null);
  const touch = useRef<{ x: number; y: number } | null>(null);
  const v = views[cur] ?? views[0];
  const tint = { "--tint": productTint(p) } as CSSProperties;

  const enter = () => {
    if (window.innerWidth <= 1180 || !window.matchMedia("(hover: hover) and (pointer: fine)").matches || !stage.current) return;
    const r = stage.current.getBoundingClientRect();
    setZoom({ w: r.width, h: r.height });
  };
  const move = (e: React.MouseEvent) => {
    if (!zoom || !stage.current) return;
    const r = stage.current.getBoundingClientRect();
    const lw = zoom.w / ZOOM;
    const lh = zoom.h / ZOOM;
    const x = Math.max(0, Math.min(zoom.w - lw, e.clientX - r.left - lw / 2));
    const y = Math.max(0, Math.min(zoom.h - lh, e.clientY - r.top - lh / 2));
    if (lens.current) lens.current.style.transform = `translate(${x}px, ${y}px)`;
    if (zin.current) zin.current.style.transform = `translate(${-x * ZOOM}px, ${-y * ZOOM}px)`;
  };
  const share = async () => {
    const data = { title, url: location.href };
    try {
      if (navigator.share) await navigator.share(data);
      else {
        await navigator.clipboard.writeText(location.href);
        toast("Link copied — share it anywhere", { icon: "check" });
      }
    } catch {
      /* dismissed */
    }
  };

  return (
    <div className="pd-gal" style={tint}>
      <div className="pd-thumbs" role="group" aria-label="Product images">
        {views.map((x, i) => (
          <button key={x.key} type="button" className={cx("pd-thumb", i === cur && "on")} onClick={() => setCur(i)} aria-label={`Show image: ${x.label}`} aria-current={i === cur || undefined}>
            <span className="pd-view">
              <ViewBody v={x} p={p} ingredients={ingredients} gift={gift} sizes="64px" title={title} />
            </span>
          </button>
        ))}
      </div>
      <div className="pd-stagecol">
        <div
          className={cx("pd-stage", zoom && "zooming")}
          ref={stage}
          onMouseEnter={enter}
          onMouseMove={move}
          onMouseLeave={() => setZoom(null)}
          onTouchStart={(e) => (touch.current = { x: e.touches[0].clientX, y: e.touches[0].clientY })}
          onTouchEnd={(e) => {
            const t = touch.current;
            touch.current = null;
            if (!t) return;
            const dx = e.changedTouches[0].clientX - t.x;
            const dy = e.changedTouches[0].clientY - t.y;
            if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) setCur((c) => (c + (dx < 0 ? 1 : -1) + views.length) % views.length);
          }}
        >
          <div className="pd-view">
            <ViewBody v={v} p={p} ingredients={ingredients} gift={gift} sizes="(max-width: 600px) 92vw, (max-width: 1180px) 600px, 460px" priority={cur === 0} title={title} />
          </div>
          {badge ? <span className="pd-stage-tag">{badge}</span> : null}
          <div className="pd-stage-ibs">
            <button type="button" className={cx("pd-ib pd-wish-ib", wished && "on")} aria-pressed={wished} aria-label={wished ? "Remove from wishlist" : "Add to wishlist"} onClick={() => void toggleWish(p.id)}>
              <Icon name="heart" />
            </button>
            <button type="button" className="pd-ib" aria-label="Share this product" onClick={share}>
              <Icon name="upload" />
            </button>
          </div>
          <span className="pd-count" aria-hidden="true">
            <b>{cur + 1}</b> / {views.length}
          </span>
          <span className="pd-lens" ref={lens} aria-hidden="true" style={zoom ? { width: zoom.w / ZOOM, height: zoom.h / ZOOM } : undefined} />
        </div>
        <p className="pd-hint">
          <span className="pd-hint-d">
            <Icon name="search" /> Roll over image to zoom in
          </span>
          <span className="pd-hint-m">Swipe or tap the thumbnails for more views</span>
        </p>
        {zoom ? (
          <div className="pd-zoom on" aria-hidden="true" style={{ width: zoom.w, height: zoom.h }}>
            <div className="pd-zoom-in" ref={zin} style={{ width: zoom.w * ZOOM, height: zoom.h * ZOOM }}>
              <div className="pd-view">
                <ViewBody v={v} p={p} ingredients={ingredients} gift={gift} sizes="1200px" title={title} />
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
