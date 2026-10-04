import { lazy, Suspense } from "react";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { ParticleBackground } from "./components/ParticleBackground";
import { RouteTransitionOverlay } from "./components/RouteTransitionOverlay";
import { ThemeProvider } from "./theme/ThemeContext";

const Layout = lazy(() => import("./layouts/Layout").then((module) => ({ default: module.Layout })));
const AdminLayout = lazy(() => import("./layouts/AdminLayout").then((module) => ({ default: module.AdminLayout })));
const Home = lazy(() => import("./pages/Home").then((module) => ({ default: module.Home })));
const About = lazy(() => import("./pages/About").then((module) => ({ default: module.About })));
const Blog = lazy(() => import("./pages/Blog").then((module) => ({ default: module.Blog })));
const PostDetail = lazy(() => import("./pages/PostDetail").then((module) => ({ default: module.PostDetail })));
const AdminLogin = lazy(() => import("./pages/admin/AdminLogin").then((module) => ({ default: module.AdminLogin })));
const Dashboard = lazy(() => import("./pages/admin/Dashboard").then((module) => ({ default: module.Dashboard })));
const MediaLibrary = lazy(() => import("./pages/admin/MediaLibrary").then((module) => ({ default: module.MediaLibrary })));
const PortfolioEditor = lazy(() => import("./pages/admin/PortfolioEditor").then((module) => ({ default: module.PortfolioEditor })));
const PostEditor = lazy(() => import("./pages/admin/PostEditor").then((module) => ({ default: module.PostEditor })));
const Settings = lazy(() => import("./pages/admin/Settings").then((module) => ({ default: module.Settings })));
const AboutEditor = lazy(() => import("./pages/admin/AboutEditor").then((module) => ({ default: module.AboutEditor })));

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
        <Suspense fallback={<div className="min-h-screen bg-bg" />}><Routes>
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
            <Route path="about" element={<AboutEditor />} />
            <Route path="settings" element={<Settings />} />
          </Route>
        </Routes></Suspense>
        <RouteTransitionOverlay />
      </BrowserRouter>
    </ThemeProvider>
  );
}

export default App;
