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
      ? "Saisakthi City — Interactive 3D Portfolio"
      : "Saisakthi M — Backend Systems Engineer";
  }, [isCity]);

  return (
    <Suspense fallback={<div style={{ width: "100%", height: "100%", background: "#101820" }} />}>
      {isCity ? <City key="city" /> : <Home key="home" />}
    </Suspense>
  );
}
