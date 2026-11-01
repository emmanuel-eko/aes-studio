import { Navigate, Route, Routes } from "react-router-dom";
import { AppShell } from "./components/layout/AppShell";
import { GlossaryPage } from "./pages/Glossary";
import { Library } from "./pages/Library";
import { Studio } from "./pages/Studio";

export default function App() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<Studio />} />
        <Route path="bibliotheque" element={<Library />} />
        <Route path="notions" element={<GlossaryPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
