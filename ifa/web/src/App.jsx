import { useEffect } from 'react';
import { Route, Routes, useLocation } from 'react-router-dom';
import { Dial, TopBar, InstallPrompt } from './components/Shell.jsx';
import { QG, PostDetail, Archives } from './screens/QG.jsx';
import { Immersion } from './screens/Immersion.jsx';
import { Labo, DropDetail } from './screens/Labo.jsx';
import { Cercles, Circle, Challenge, FanPost, Publish, UserProfile } from './screens/Cercles.jsx';
import { Artist } from './screens/Artist.jsx';
import { Signaux } from './screens/Signaux.jsx';
import { Me, NotifSettings, Privacy } from './screens/Me.jsx';
import { Welcome, ParentConsent } from './screens/Auth.jsx';
import { Legal } from './screens/Legal.jsx';
import { Regie } from './admin/Regie.jsx';
import { Empty } from './components/ui.jsx';

const NO_CHROME = ['/bienvenue', '/parent/', '/regie'];

export default function App() {
  const { pathname } = useLocation();
  useEffect(() => { if (!pathname.startsWith('/immersion')) window.scrollTo(0, 0); }, [pathname]);
  const bare = NO_CHROME.some((p) => pathname.startsWith(p));
  const immersive = pathname.startsWith('/immersion');
  return (
    <div className={bare ? '' : 'app'}>
      {!bare && <TopBar transparent={immersive} />}
      <Routes>
        <Route path="/" element={<QG />} />
        <Route path="/qg/archives" element={<Archives />} />
        <Route path="/qg/:id" element={<PostDetail />} />
        <Route path="/immersion" element={<Immersion />} />
        <Route path="/labo" element={<Labo />} />
        <Route path="/labo/:id" element={<DropDetail />} />
        <Route path="/cercles" element={<Cercles />} />
        <Route path="/cercles/publier" element={<Publish />} />
        <Route path="/cercles/defi/:id" element={<Challenge />} />
        <Route path="/cercles/creation/:id" element={<FanPost />} />
        <Route path="/cercles/:slug" element={<Circle />} />
        <Route path="/u/:handle" element={<UserProfile />} />
        <Route path="/ifa" element={<Artist />} />
        <Route path="/signaux" element={<Signaux />} />
        <Route path="/moi" element={<Me />} />
        <Route path="/moi/signaux" element={<NotifSettings />} />
        <Route path="/moi/confidentialite" element={<Privacy />} />
        <Route path="/bienvenue" element={<Welcome />} />
        <Route path="/parent/:token" element={<ParentConsent />} />
        <Route path="/legal/:page" element={<Legal />} />
        <Route path="/regie/*" element={<Regie />} />
        <Route path="*" element={<div className="page"><Empty title="Hors fréquence">Cette page n'existe pas.</Empty></div>} />
      </Routes>
      {!bare && <Dial />}
      {!bare && <InstallPrompt />}
    </div>
  );
}
