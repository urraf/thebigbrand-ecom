"use client";
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { Icon } from "@/components/ui/icon";
import { cx } from "@/components/ui/cx";
import { toast } from "@/components/ui/toast";
import { useReducedMotion } from "./hooks";

export type VideoScene = { cc: string; content: ReactNode };

type Props = {
  /** campaign id for impression tracking */
  trackId: string;
  style?: CSSProperties;
  /** simulated video: server-rendered scenes (photos or product art) played as a muted 30 s spot */
  scenes: VideoScene[];
  /** real video file (mp4/webm) — used instead of the simulated scenes when present */
  videoUrl?: string | null;
  poster?: string | null;
  tag: ReactNode;
  ctaHref: string;
  ctaLabel: string;
  title: string;
};

const LEN = 30;
const STEP = 0.25;
const VOL_ON = (
  <svg className="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M11 5 6 9H2v6h4l5 4V5z" />
    <path d="M15.5 8.5a5 5 0 0 1 0 7M19 5a10 10 0 0 1 0 14" />
  </svg>
);

const mmss = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

/**
 * H5 video billboard player (port of the demo's mountVideo). Plays only while ≥50% in view and the tab is
 * visible (a viewable impression), muted by default, with progress bar, play/pause, mute and a CTA.
 */
export function VideoPlayer({ trackId, style, scenes, videoUrl, poster, tag, ctaHref, ctaLabel, title }: Props) {
  const root = useRef<HTMLDivElement>(null);
  const bar = useRef<HTMLElement>(null);
  const time = useRef<HTMLElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const [scene, setScene] = useState(0);
  const reduce = useReducedMotion();
  const [userChoice, setUserChoice] = useState<boolean | null>(null);
  const userPaused = userChoice ?? reduce;
  const setUserPaused = (v: boolean | ((u: boolean) => boolean)) => setUserChoice(typeof v === "function" ? v(userPaused) : v);
  const [running, setRunning] = useState(false);
  const [sound, setSound] = useState(false);
  const [len, setLen] = useState(LEN);
  const tRef = useRef(0);
  const inView = useRef(false);

  // play only while ≥50% visible
  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const sync = () => setRunning(inView.current && document.visibilityState === "visible");
    let io: IntersectionObserver | null = null;
    if ("IntersectionObserver" in window) {
      io = new IntersectionObserver(
        (es) => {
          const e = es[es.length - 1];
          inView.current = e.isIntersecting && e.intersectionRatio >= 0.5;
          sync();
        },
        { threshold: [0, 0.5, 1] },
      );
      io.observe(el);
    } else {
      inView.current = true;
      sync();
    }
    document.addEventListener("visibilitychange", sync);
    return () => {
      io?.disconnect();
      document.removeEventListener("visibilitychange", sync);
    };
  }, []);

  const playing = running && !userPaused;

  // simulated playback clock
  useEffect(() => {
    if (videoUrl || !playing) return;
    const n = Math.max(1, scenes.length);
    const iv = setInterval(() => {
      tRef.current = tRef.current + STEP >= LEN ? 0 : tRef.current + STEP;
      const t = tRef.current;
      if (bar.current) bar.current.style.transform = `scaleX(${t / LEN})`;
      if (time.current) time.current.textContent = mmss(t);
      const k = Math.min(n - 1, Math.floor(t / (LEN / n)));
      setScene((s) => (s === k ? s : k));
    }, STEP * 1000);
    return () => clearInterval(iv);
  }, [playing, videoUrl, scenes.length]);

  // real video
  useEffect(() => {
    const v = video.current;
    if (!v) return;
    if (playing) void v.play().catch(() => {});
    else v.pause();
  }, [playing]);

  const toggleSound = () => {
    const on = !sound;
    setSound(on);
    if (video.current) video.current.muted = !on;
    else if (on) toast("Sound on — captions stay visible for this spot", { icon: "info" });
  };

  const cc = videoUrl ? null : scenes[scene]?.cc;
  return (
    <div
      ref={root}
      className={cx("zn-player", !playing && "is-paused", userPaused && "is-user-paused", sound && "is-sound", videoUrl && "has-video")}
      style={style}
      data-pz-imp={trackId}
    >
      {videoUrl ? (
        <video
          ref={video}
          className="zn-video"
          src={videoUrl}
          poster={poster ?? undefined}
          muted
          loop
          playsInline
          preload="metadata"
          aria-label={title}
          onLoadedMetadata={(e) => setLen(Math.round(e.currentTarget.duration) || LEN)}
          onTimeUpdate={(e) => {
            const v = e.currentTarget;
            if (bar.current && v.duration) bar.current.style.transform = `scaleX(${v.currentTime / v.duration})`;
            if (time.current) time.current.textContent = mmss(v.currentTime);
          }}
        />
      ) : (
        scenes.map((s, k) => (
          <div key={k} className={cx("zn-scn", k === scene && "is-on")} aria-hidden={k === scene ? undefined : true}>
            {s.content}
          </div>
        ))
      )}
      {!videoUrl ? (
        <span className="zn-bokeh" aria-hidden="true">
          <i />
          <i />
          <i />
          <i />
        </span>
      ) : null}
      <div className="zn-vtop">
        {tag}
        <span className="zn-vlen">
          <Icon name="clock" />
          {mmss(len)}
        </span>
      </div>
      {cc ? (
        <p className="zn-cc" aria-hidden="true">
          {cc}
        </p>
      ) : null}
      <button type="button" className="zn-vbig" onClick={() => setUserPaused(false)} aria-label="Play video" tabIndex={userPaused ? 0 : -1}>
        <Icon name="play" />
      </button>
      <div className="zn-vui">
        <div className="zn-vbar" aria-hidden="true">
          <i ref={bar} />
        </div>
        <div className="zn-vctl">
          <button type="button" className="zn-vbtn zn-vpp" onClick={() => setUserPaused((u) => !u)} aria-label={userPaused ? "Play video" : "Pause video"}>
            <Icon name={userPaused ? "play" : "pause"} />
          </button>
          <button type="button" className="zn-vbtn" onClick={toggleSound} aria-label={sound ? "Mute video" : "Unmute video"} aria-pressed={sound}>
            {sound ? VOL_ON : <Icon name="volumeOff" />}
          </button>
          <span className="zn-vtime">
            <b ref={time}>0:00</b> / {mmss(len)}
          </span>
          <a className="zn-vcta" href={ctaHref} rel="sponsored">
            {ctaLabel}
            <Icon name="arrow" />
          </a>
        </div>
      </div>
    </div>
  );
}
