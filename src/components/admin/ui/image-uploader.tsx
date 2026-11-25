"use client";
/**
 * ImageUploader — upload (click or drop, multiple), reorder and remove images. Files go to
 * POST /api/v1/admin/media (multipart `file`, JPG/PNG/WEBP/AVIF/GIF ≤ 5 MB) which stores them via storeUpload().
 * Controlled: `value` is the ordered list (first = cover); the parent saves it with its own form.
 *
 *   <ImageUploader value={images} onChange={setImages} max={8} />
 *   type UploadedImage = { url: string; alt?: string | null }
 *
 * `endpoint` can point at another upload route with the same contract (e.g. the seller portal's).
 */
import { useLayoutEffect, useRef, useState, type DragEvent } from "react";
import { Icon } from "@/components/ui/icon";
import { cx } from "@/components/ui/cx";
import { toast } from "@/components/ui/toast";
import { adminFetch, AdminApiError } from "./use-admin-action";

export type UploadedImage = { url: string; alt?: string | null };

const ACCEPT = "image/jpeg,image/png,image/webp,image/avif,image/gif";
const MAX_BYTES = 5 * 1024 * 1024;

export function ImageUploader({
  value,
  onChange,
  max = 8,
  endpoint = "/api/v1/admin/media",
  label = "Add images",
}: {
  value: UploadedImage[];
  onChange: (next: UploadedImage[]) => void;
  max?: number;
  endpoint?: string;
  label?: string;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(0);
  const [over, setOver] = useState(false);
  const latest = useRef(value);
  useLayoutEffect(() => {
    latest.current = value;
  }, [value]);

  async function upload(files: FileList | File[]) {
    const list = Array.from(files).slice(0, Math.max(0, max - latest.current.length));
    if (!list.length) {
      toast(`You can add up to ${max} images`, { icon: "info" });
      return;
    }
    for (const f of list) {
      if (!ACCEPT.split(",").includes(f.type)) {
        toast(`${f.name}: only JPG, PNG, WEBP, AVIF or GIF`, { icon: "info" });
        continue;
      }
      if (f.size > MAX_BYTES) {
        toast(`${f.name} is larger than 5 MB`, { icon: "info" });
        continue;
      }
      setUploading((n) => n + 1);
      try {
        const fd = new FormData();
        fd.append("file", f);
        const res = await adminFetch<{ url: string }>(endpoint, { method: "POST", body: fd });
        const next = [...latest.current, { url: res.url, alt: null }];
        latest.current = next;
        onChange(next);
      } catch (e) {
        toast(e instanceof AdminApiError ? e.message : "Upload failed", { icon: "info" });
      } finally {
        setUploading((n) => n - 1);
      }
    }
  }

  function move(i: number, d: -1 | 1) {
    const j = i + d;
    if (j < 0 || j >= value.length) return;
    const next = [...value];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  }

  function onDrop(e: DragEvent) {
    e.preventDefault();
    setOver(false);
    if (e.dataTransfer.files?.length) upload(e.dataTransfer.files);
  }

  return (
    <div className="am-upl">
      <div className="am-upl-grid">
        {value.map((img, i) => (
          <figure className="am-upl-item" key={img.url + i}>
            {/* eslint-disable-next-line @next/next/no-img-element -- admin preview of arbitrary uploads */}
            <img src={img.url} alt={img.alt || `Image ${i + 1}`} loading="lazy" />
            {i === 0 ? <span className="am-upl-cover">Cover</span> : null}
            <div className="am-upl-tools">
              <button type="button" onClick={() => move(i, -1)} disabled={i === 0} aria-label={`Move image ${i + 1} left`}>
                <Icon name="chevLeft" />
              </button>
              <button type="button" onClick={() => move(i, 1)} disabled={i === value.length - 1} aria-label={`Move image ${i + 1} right`}>
                <Icon name="chevRight" />
              </button>
              <button type="button" onClick={() => onChange(value.filter((_, k) => k !== i))} aria-label={`Remove image ${i + 1}`}>
                <Icon name="trash" />
              </button>
            </div>
          </figure>
        ))}
        {value.length < max ? (
          <button
            type="button"
            className={cx("am-upl-drop", over && "is-over")}
            onClick={() => input.current?.click()}
            onDragOver={(e) => {
              e.preventDefault();
              setOver(true);
            }}
            onDragLeave={() => setOver(false)}
            onDrop={onDrop}
            aria-label={label}
          >
            {uploading ? (
              <span>Uploading {uploading}…</span>
            ) : (
              <>
                <Icon name="upload" />
                <b>{label}</b>
                <span>or drop here · max 5 MB</span>
              </>
            )}
          </button>
        ) : null}
      </div>
      <input
        ref={input}
        type="file"
        accept={ACCEPT}
        multiple
        hidden
        onChange={(e) => {
          if (e.target.files?.length) upload(e.target.files);
          e.target.value = "";
        }}
      />
    </div>
  );
}
