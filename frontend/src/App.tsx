import { BrowserRouter, Route, Routes } from "react-router-dom";
import { ParticleBackground } from "./components/ParticleBackground";
import { RouteTransitionOverlay } from "./components/RouteTransitionOverlay";
import { AdminLayout } from "./layouts/AdminLayout";
import { Layout } from "./layouts/Layout";
import { About } from "./pages/About";
import { Blog } from "./pages/Blog";
import { Home } from "./pages/Home";
import { PostDetail } from "./pages/PostDetail";
import { AdminLogin } from "./pages/admin/AdminLogin";
import { Dashboard } from "./pages/admin/Dashboard";
import { MediaLibrary } from "./pages/admin/MediaLibrary";
import { PortfolioEditor } from "./pages/admin/PortfolioEditor";
import { PostEditor } from "./pages/admin/PostEditor";
import { Settings } from "./pages/admin/Settings";
import { ThemeProvider } from "./theme/ThemeContext";

// Route tree matches capture/routes.md exactly (11 routes: 4 public + 7
// admin). No wildcard/404 route - the live site doesn't have one either
// (confirmed: unmatched paths render nothing at all, see
// capture/interactions.md) - reproduced faithfully here too, foundation
// stage isn't the place to silently add product behaviour the original
// doesn't have.
function App() {
  return (
    <ThemeProvider>
      <BrowserRouter>
        <ParticleBackground />
        <Routes>
          <Route path="/" element={<Layout />}>
            <Route index element={<Home />} />
            <Route path="about" element={<About />} />
            <Route path="blog" element={<Blog />} />
            <Route path="post/:slug" element={<PostDetail />} />
          </Route>
          <Route path="/admin/login" element={<AdminLogin />} />
          <Route path="/admin" element={<AdminLayout />}>
            <Route index element={<Dashboard />} />
            <Route path="post/new" element={<PostEditor />} />
            <Route path="post/:id" element={<PostEditor />} />
            <Route path="media" element={<MediaLibrary />} />
            <Route path="portfolio" element={<PortfolioEditor />} />
            <Route path="settings" element={<Settings />} />
          </Route>
        </Routes>
        <RouteTransitionOverlay />
      </BrowserRouter>
    </ThemeProvider>
  );
}

export default App;
