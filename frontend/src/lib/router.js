import { useEffect, useState } from "react";

// Minimal hash router: instant, no extra dependency, browser back works.
const read = () => window.location.hash.replace(/^#/, "") || "/";

export function useRoute() {
  const [route, setRoute] = useState(read);
  useEffect(() => {
    const onChange = () => setRoute(read());
    window.addEventListener("hashchange", onChange);
    return () => window.removeEventListener("hashchange", onChange);
  }, []);
  return route;
}

export const navigate = (path) => {
  window.location.hash = path;
};
