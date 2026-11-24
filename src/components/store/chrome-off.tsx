/**
 * Drop <ChromeOff /> anywhere in a store page (e.g. a focused checkout) to hide the store header, footer
 * and mobile tab bar — pure CSS (`body:has([data-chrome-off])`), so it works in the static HTML with no
 * flash and no JS.
 */
export function ChromeOff() {
  return <span data-chrome-off="" hidden />;
}
