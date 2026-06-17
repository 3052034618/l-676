import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Layout from "@/components/Layout";
import Home from "@/pages/Home";
import Meetings from "@/pages/Meetings";
import MeetingDetail from "@/pages/MeetingDetail";
import Tasks from "@/pages/Tasks";
import Reports from "@/pages/Reports";
import Search from "@/pages/Search";
import Logs from "@/pages/Logs";

export default function App() {
  return (
    <Router>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Home />} />
          <Route path="/meetings" element={<Meetings />} />
          <Route path="/meetings/:id" element={<MeetingDetail />} />
          <Route path="/tasks" element={<Tasks />} />
          <Route path="/tasks/:id" element={<Tasks />} />
          <Route path="/reports" element={<Reports />} />
          <Route path="/search" element={<Search />} />
          <Route path="/logs" element={<Logs />} />
        </Route>
      </Routes>
    </Router>
  );
}
