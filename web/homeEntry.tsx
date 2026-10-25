import { createRoot } from "react-dom/client";
import { HomePage } from "./HomePage";

const root = document.getElementById("videogen-home-root");
if (root != null) {
  createRoot(root).render(
    <HomePage appUrl={root.dataset.appUrl ?? "https://app.videogen.io"} />,
  );
}
