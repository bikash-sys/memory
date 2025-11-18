import { useState } from "react";
import axios from "axios";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { MapPin, User, Mail, Lock, Phone } from "lucide-react";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

function AuthPage({ onLogin }) {
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    username: "",
    email: "",
    password: "",
    phone: "",
  });

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const endpoint = isLogin ? "/auth/login" : "/auth/register";
      const payload = isLogin
        ? { email: formData.email, password: formData.password }
        : formData;

      const response = await axios.post(`${API}${endpoint}`, payload);
      const { token, user } = response.data;

      onLogin(token, user);
      toast.success(isLogin ? "Welcome back!" : "Account created successfully!");
    } catch (error) {
      toast.error(error.response?.data?.detail || "Authentication failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen auth-gradient flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8 fade-in">
          <div className="flex items-center justify-center mb-4">
            <MapPin className="w-12 h-12 text-emerald-500" />
          </div>
          <h1 className="text-4xl lg:text-5xl font-bold text-white mb-2">
            Bangalore Memory Map
          </h1>
          <p className="text-base text-gray-300">
            Share your stories, discover hidden gems
          </p>
        </div>

        {/* Auth Card */}
        <Card className="p-8 memory-card fade-in border-slate-700">
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-white mb-2">
              {isLogin ? "Welcome Back" : "Create Account"}
            </h2>
            <p className="text-sm text-gray-300">
              {isLogin
                ? "Sign in to access your memories"
                : "Join the memory sharing community"}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {!isLogin && (
              <div data-testid="username-field">
                <Label htmlFor="username" className="text-sm font-medium text-gray-200">
                  Username
                </Label>
                <div className="relative mt-1">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <Input
                    id="username"
                    name="username"
                    type="text"
                    required={!isLogin}
                    value={formData.username}
                    onChange={handleChange}
                    className="pl-10 bg-slate-700 border-slate-600 text-white placeholder:text-gray-400"
                    placeholder="Choose a username"
                    data-testid="username-input"
                  />
                </div>
              </div>
            )}

            <div data-testid="email-field">
              <Label htmlFor="email" className="text-sm font-medium text-gray-200">
                Email
              </Label>
              <div className="relative mt-1">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  id="email"
                  name="email"
                  type="email"
                  required
                  value={formData.email}
                  onChange={handleChange}
                  className="pl-10 bg-slate-700 border-slate-600 text-white placeholder:text-gray-400"
                  placeholder="your@email.com"
                  data-testid="email-input"
                />
              </div>
            </div>

            <div data-testid="password-field">
              <Label htmlFor="password" className="text-sm font-medium text-gray-200">
                Password
              </Label>
              <div className="relative mt-1">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  id="password"
                  name="password"
                  type="password"
                  required
                  value={formData.password}
                  onChange={handleChange}
                  className="pl-10 bg-slate-700 border-slate-600 text-white placeholder:text-gray-400"
                  placeholder="••••••••"
                  data-testid="password-input"
                />
              </div>
            </div>

            {!isLogin && (
              <div data-testid="phone-field">
                <Label htmlFor="phone" className="text-sm font-medium text-gray-200">
                  Phone (Optional)
                </Label>
                <div className="relative mt-1">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <Input
                    id="phone"
                    name="phone"
                    type="tel"
                    value={formData.phone}
                    onChange={handleChange}
                    className="pl-10 bg-slate-700 border-slate-600 text-white placeholder:text-gray-400"
                    placeholder="+91 1234567890"
                    data-testid="phone-input"
                  />
                </div>
              </div>
            )}

            <Button
              type="submit"
              className="w-full bg-emerald-600 hover:bg-emerald-700 button-hover text-white"
              disabled={loading}
              data-testid="auth-submit-button"
            >
              {loading ? "Please wait..." : isLogin ? "Sign In" : "Create Account"}
            </Button>
          </form>

          <div className="mt-6 text-center">
            <button
              onClick={() => setIsLogin(!isLogin)}
              className="text-sm text-emerald-400 hover:text-emerald-300 font-medium"
              data-testid="toggle-auth-mode"
            >
              {isLogin
                ? "Don't have an account? Sign up"
                : "Already have an account? Sign in"}
            </button>
          </div>
        </Card>
      </div>
    </div>
  );
}

export default AuthPage;
