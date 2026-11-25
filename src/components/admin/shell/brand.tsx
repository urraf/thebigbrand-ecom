import Link from "next/link";

/** Console logo: gradient "tbb" tile + thebigbrands.co.in / ADMIN CONSOLE. */
export function ConsoleLogo() {
  return (
    <Link className="am-logo" href="/admin" aria-label="The Big Brands admin home">
      <span className="logo-mark">
        <i aria-hidden="true">tbb</i>
      </span>
      <span className="am-logo-t">
        <b>
          thebigbrands<em>.co.in</em>
        </b>
        <small>Admin console</small>
      </span>
    </Link>
  );
}
