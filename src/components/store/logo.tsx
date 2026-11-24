import { site } from "@/lib/site";

/** Brand mark: gradient "tbb" tile + thebigbrands.co.in + "A Shriram Ventures Initiative" (demo logoMark). */
export function LogoMark() {
  return (
    <span className="logo-mark">
      <i aria-hidden="true">tbb</i>
      <span className="logo-stack">
        <span className="logo-txt">
          thebigbrands<em>.co.in</em>
        </span>
        <small className="logo-sub">{site.tagline}</small>
      </span>
    </span>
  );
}
