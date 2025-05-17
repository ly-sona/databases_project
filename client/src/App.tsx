import { BrowserRouter as Router, Routes, Route, Link, useLocation, Navigate, useNavigate } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import ItemsSold from "./components/ItemsSold";
import AvgSalary from "./components/AvgSalary";
import Rounds from "./components/Rounds";
import PartCost from "./components/PartCost";
import CustomQuery from "./components/CustomQuery";
import UserManagement from "./components/UserManagement";
import SqlInjectionDemo from "./components/SqlInjectionDemo";
import { useState } from "react";
import { FaHome, FaBoxOpen, FaDollarSign, FaUserTie, FaCogs, FaDatabase, FaUsers, FaSignOutAlt, FaShieldAlt } from "react-icons/fa";
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Login from './components/Login';
import ProtectedRoute from './components/ProtectedRoute';
import { Box, Typography, Paper } from '@mui/material';

const queryClient = new QueryClient();

function Sidebar() {
  const location = useLocation();
  const [isOpen, setIsOpen] = useState(true);
  const { hasPermission, logout, user } = useAuth();
  const navigate = useNavigate();
  
  const navItems = [
    { path: "/", label: "Home", icon: <FaHome /> },
    { path: "/items", label: "Items Sold", icon: <FaBoxOpen /> },
    { path: "/salary", label: "Avg Salary", icon: <FaDollarSign /> },
    { path: "/rounds", label: "Interview Rounds", icon: <FaUserTie /> },
    { path: "/partcost", label: "Part Costs", icon: <FaCogs /> },
    { path: "/custom-query", label: "Custom Query", icon: <FaDatabase /> },
  ];

  // Add user management link if user has any user-related permission
  const hasAnyUserPermission = hasPermission('create_user') || 
                             hasPermission('update_user') || 
                             hasPermission('delete_user') || 
                             hasPermission('view_users') ||
                             hasPermission('admin');
  
  if (hasAnyUserPermission) {
    navItems.push({ path: "/users", label: "User Management", icon: <FaUsers /> });
    navItems.push({ path: "/sql-injection", label: "SQL Injection Demo", icon: <FaShieldAlt /> })
  }

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="fixed left-0 top-0 h-full bg-white shadow-lg w-64 z-20">
      <div className="p-4 border-b flex justify-between items-center">
        <h1 className="font-bold text-sky-900 text-lg flex items-center gap-2">
          <FaDatabase className="text-sky-700 text-2xl" /> Database
        </h1>
        {user && (
          <span className="text-sm text-gray-600">
            {user.username}
          </span>
        )}
      </div>
      
      <nav className="mt-4">
        <ul>
          {navItems.map((item) => (
            <li key={item.path} className="mb-1">
              <Link
                to={item.path}
                className={`flex items-center gap-3 px-4 py-2 rounded-lg transition-all duration-150 font-medium text-base
                  ${location.pathname === item.path
                    ? 'bg-sky-900 text-white shadow-md scale-[1.03]'
                    : 'text-gray-700 hover:bg-sky-100 hover:text-sky-900 active:bg-sky-200 active:scale-95'}
                `}
                style={{ userSelect: 'none' }}
              >
                <span className="text-lg">{item.icon}</span>
                <span>{item.label}</span>
              </Link>
            </li>
          ))}
          
          {user && (
            <li className="mt-4">
              <button
                onClick={handleLogout}
                className="flex items-center gap-3 px-4 py-2 rounded-lg transition-all duration-150 font-medium text-base w-full text-left
                  text-red-700 hover:bg-red-100 hover:text-red-900 active:bg-red-200 active:scale-95"
                style={{ userSelect: 'none' }}
              >
                <span className="text-lg"><FaSignOutAlt /></span>
                <span>Logout</span>
              </button>
            </li>
          )}
        </ul>
      </nav>
    </div>
  );
}

function Homepage() {
  return (
    <div className="relative min-h-screen overflow-y-auto ml-64">
      {/* Background Pattern */}
      <div className="fixed inset-0 bg-gradient-to-b from-blue-200 via-blue-100 to-white">
      </div>
      {/* Foreground Content: Mini Dashboard */}
      <div className="relative z-10 flex flex-col items-center justify-start px-4 py-8 w-full">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full max-w-[95%] mx-auto">
          <div className="w-full">
            <ItemsSold compact defaultPageSize={5} />
          </div>
          <div className="w-full">
            <AvgSalary compact defaultPageSize={5} />
          </div>
          <div className="w-full">
            <Rounds compact defaultPageSize={5} />
          </div>
          <div className="w-full">
            <PartCost compact defaultPageSize={5} />
          </div>
        </div>
      </div>
    </div>
  );
}

function ContentWrapper({ children }: { children: React.ReactNode }) {
  return (
    <div className="ml-64 relative min-h-screen">
      {/* Content */}
      <div className="relative z-10 p-8">
        {children}
      </div>
    </div>
  );
}

function Dashboard() {
  return (
    <Box sx={{ 
      p: 2, 
      height: 'calc(100vh - 64px)',
      ml: '256px' // Account for sidebar width (64 * 4 = 256px)
    }}>
      <Box sx={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(2, 1fr)', 
        gap: 2,
        height: '100%'
      }}>
        <Box sx={{ height: '100%', overflow: 'hidden' }}>
          <ItemsSold compact defaultPageSize={5} />
        </Box>

        <Box sx={{ height: '100%', overflow: 'hidden' }}>
          <AvgSalary compact defaultPageSize={5} />
        </Box>

        <Box sx={{ height: '100%', overflow: 'hidden' }}>
          <Rounds compact defaultPageSize={5} />
        </Box>

        <Box sx={{ height: '100%', overflow: 'hidden' }}>
          <PartCost compact defaultPageSize={5} />
        </Box>
      </Box>
    </Box>
  );
}

function Unauthorized() {
  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" color="error">
        Unauthorized
      </Typography>
      <Typography>You don't have permission to access this page.</Typography>
    </Box>
  );
}

function AppContent() {
  const location = useLocation();
  const isLoginPage = location.pathname === '/login';

  return (
    <div className="relative min-h-screen w-full">
      {/* Full background pattern for the entire app */}
      <div className="fixed inset-0 bg-gradient-to-b from-blue-200 via-blue-100 to-white">
      </div>
      
      {/* App content */}
      <div className="relative z-10 min-h-screen">
        {/* Sidebar - only show when not on login page */}
        {!isLoginPage && <Sidebar />}
        
        {/* Main Content */}
        <main>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/" element={<ProtectedRoute><Homepage /></ProtectedRoute>} />
            <Route path="/items" element={<ProtectedRoute><ContentWrapper><ItemsSold /></ContentWrapper></ProtectedRoute>} />
            <Route path="/salary" element={<ProtectedRoute><ContentWrapper><AvgSalary /></ContentWrapper></ProtectedRoute>} />
            <Route path="/rounds" element={<ProtectedRoute><ContentWrapper><Rounds /></ContentWrapper></ProtectedRoute>} />
            <Route path="/partcost" element={<ProtectedRoute><ContentWrapper><PartCost /></ContentWrapper></ProtectedRoute>} />
            <Route path="/custom-query" element={<ProtectedRoute requiredPermission="read_query"><ContentWrapper><CustomQuery /></ContentWrapper></ProtectedRoute>} />
            <Route path="/users" element={<ProtectedRoute requiredPermission="view_users"><ContentWrapper><UserManagement /></ContentWrapper></ProtectedRoute>} />
            <Route path="/sql-injection" element={<ProtectedRoute><ContentWrapper><SqlInjectionDemo /></ContentWrapper></ProtectedRoute>} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}

function App() {
  return (
    <AuthProvider>
      <QueryClientProvider client={queryClient}>
        <Router>
          <AppContent />
        </Router>
      </QueryClientProvider>
    </AuthProvider>
  );
}

export default App;
