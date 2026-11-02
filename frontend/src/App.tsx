import { Navigate, Route, Routes } from "react-router-dom";
import { AppShell } from "./components/layout/AppShell";
import { GlossaryPage } from "./pages/Glossary";
import { Library } from "./pages/Library";
import { Studio } from "./pages/Studio";
import { SimpleAES } from "./pages/SimpleAES";

export default function App() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<SimpleAES />} />
        <Route path="avance" element={<Studio />} />
        <Route path="bibliotheque" element={<Library />} />
        <Route path="notions" element={<GlossaryPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
