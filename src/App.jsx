import { Routes, Route } from 'react-router-dom'
import Layout from './components/Layout.jsx'
import Home from './pages/Home.jsx'
import SchoolCampaign from './pages/SchoolCampaign.jsx'
import KidLogin from './pages/KidLogin.jsx'
import KidDashboard from './pages/KidDashboard.jsx'
import AdminLogin from './pages/AdminLogin.jsx'
import AdminDashboard from './pages/AdminDashboard.jsx'
import HowTo from './pages/HowTo.jsx'
import NotFound from './pages/NotFound.jsx'

export default function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/s/:schoolId" element={<SchoolCampaign />} />
        <Route path="/login" element={<KidLogin />} />
        <Route path="/me" element={<KidDashboard />} />
        <Route path="/admin/login" element={<AdminLogin />} />
        <Route path="/admin" element={<AdminDashboard />} />
        <Route path="/how-to" element={<HowTo />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Layout>
  )
}
