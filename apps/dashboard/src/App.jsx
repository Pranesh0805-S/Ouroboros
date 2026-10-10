import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom';
import IncidentFeed from './pages/IncidentFeed.jsx';
import PatchReview from './pages/PatchReview.jsx';
import Metrics from './pages/Metrics.jsx';

export default function App() {
  return (
    <BrowserRouter>
      <nav className="nav">
        <span className="brand">🐍 Ouroboros</span>
        <NavLink to="/" end>Incidents</NavLink>
        <NavLink to="/metrics">Metrics</NavLink>
      </nav>
      <main className="container">
        <Routes>
          <Route path="/" element={<IncidentFeed />} />
          <Route path="/incidents/:id" element={<PatchReview />} />
          <Route path="/metrics" element={<Metrics />} />
        </Routes>
      </main>
    </BrowserRouter>
  );
}
