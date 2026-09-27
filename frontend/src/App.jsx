import { BrowserRouter, Routes, Route } from "react-router-dom";
import HomePage from "./pages/HomePage";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        {/* Later: /profile, /assessment, /explore, /roadmap, /mentor */}
      </Routes>
    </BrowserRouter>
  );
}
