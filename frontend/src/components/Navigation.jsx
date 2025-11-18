import { useNavigate, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { MapPin, Grid3x3, Navigation, Users, LogOut } from "lucide-react";

function NavigationBar({ onLogout }) {
  const navigate = useNavigate();
  const location = useLocation();

  const isActive = (path) => location.pathname === path;

  const navItems = [
    { path: '/', label: 'Map', icon: MapPin },
    { path: '/my-memories', label: 'My Memories', icon: Grid3x3 },
    { path: '/nearby', label: 'Nearby', icon: Navigation },
  ];

  return (
    <header className="bg-slate-800 border-b border-slate-700 shadow-sm sticky top-0 z-50">
      <div className="px-4 py-3 flex items-center justify-between max-w-7xl mx-auto">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-3">
            <MapPin className="w-6 h-6 text-emerald-500" />
            <h1 className="text-xl font-bold text-white hidden sm:block">
              Bangalore Memory Map
            </h1>
          </div>
          
          <nav className="flex items-center gap-2">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <Button
                  key={item.path}
                  variant={isActive(item.path) ? "default" : "ghost"}
                  size="sm"
                  onClick={() => navigate(item.path)}
                  className={
                    isActive(item.path)
                      ? "bg-emerald-600 hover:bg-emerald-700 text-white gap-2"
                      : "text-gray-300 hover:text-white hover:bg-slate-700 gap-2"
                  }
                  data-testid={`nav-${item.label.toLowerCase().replace(' ', '-')}`}
                >
                  <Icon className="w-4 h-4" />
                  <span className="hidden sm:inline">{item.label}</span>
                </Button>
              );
            })}
          </nav>
        </div>
        
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate('/profile')}
            className="gap-2 border-slate-600 hover:bg-slate-700 text-white"
            data-testid="profile-button"
          >
            <Users className="w-4 h-4" />
            <span className="hidden sm:inline">Friends</span>
          </Button>
          
          <Button
            variant="ghost"
            size="sm"
            onClick={onLogout}
            className="gap-2 hover:bg-slate-700 text-white"
            data-testid="logout-button"
          >
            <LogOut className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </header>
  );
}

export default NavigationBar;
