import {
  useEffect,
  useState,
  type AnchorHTMLAttributes,
  type MouseEvent,
} from "react";

/**
 * Tiny History-API router (no extra dependency).
 * Works with Vite's `base` option: everything is resolved relative to BASE_URL.
 */
const basePath = (() => {
  try {
    return new URL(import.meta.env.BASE_URL, window.location.href).pathname.replace(/\/+$/, "");
  } catch {
    return "";
  }
})();

function currentPath() {
  let path = window.location.pathname;
  if (basePath && path.startsWith(basePath)) path = path.slice(basePath.length);
  path = path.replace(/\/+$/, "");
  return path || "/";
}

export function navigate(to: string) {
  if (to === currentPath()) return;
  window.history.pushState({}, "", basePath + to);
  window.dispatchEvent(new PopStateEvent("popstate"));
}

export function usePath() {
  const [path, setPath] = useState(currentPath);
  useEffect(() => {
    const sync = () => setPath(currentPath());
    window.addEventListener("popstate", sync);
    return () => window.removeEventListener("popstate", sync);
  }, []);
  return path;
}

type LinkProps = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href"> & { to: string };

export function Link({ to, onClick, children, ...rest }: LinkProps) {
  const handleClick = (event: MouseEvent<HTMLAnchorElement>) => {
    onClick?.(event);
    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    ) {
      return;
    }
    event.preventDefault();
    navigate(to);
  };
  return (
    <a href={basePath + to} onClick={handleClick} {...rest}>
      {children}
    </a>
  );
}
