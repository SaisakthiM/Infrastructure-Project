import { lazy, Suspense, useEffect } from "react";
import { usePath } from "./lib/router";

// Each route is code-split so the city never downloads for home visitors (and vice versa).
const Home = lazy(() => import("./pages/Home"));
const City = lazy(() => import("./pages/City"));

export default function App() {
  const path = usePath();
  const isCity = path === "/city" || path.startsWith("/city/");

  useEffect(() => {
    document.title = isCity
      ? "Mini City — Walk the registry"
      : "Mini City — Saisakthi M, Backend Systems Engineer";
  }, [isCity]);

  return (
    <Suspense fallback={<div style={{ width: "100%", height: "100%", background: "#f4f2ed" }} />}>
      {isCity ? <City key="city" /> : <Home key="home" />}
    </Suspense>
  );
}
