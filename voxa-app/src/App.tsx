import { Routes, Route } from 'react-router-dom'
import Home from './pages/Home'
import ConversationSetup from './pages/ConversationSetup'
import LiveConversation from './pages/LiveConversation'
import History from './pages/History'
import Settings from './pages/Settings'

export default function App() {
  return (
    <div className="min-h-screen w-full max-w-md mx-auto flex flex-col bg-void">
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/setup" element={<ConversationSetup />} />
        <Route path="/live" element={<LiveConversation />} />
        <Route path="/history" element={<History />} />
        <Route path="/settings" element={<Settings />} />
      </Routes>
    </div>
  )
}
