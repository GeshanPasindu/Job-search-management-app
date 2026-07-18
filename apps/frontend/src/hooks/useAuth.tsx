import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { api, setAccessToken, setUnauthorizedCallback } from "../api";
import { AuthUser } from "../types";

type AuthContextType = {
  user: AuthUser | null;
  loading: boolean;
  login: (token: string, refreshToken: string, user: AuthUser) => void;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    setUnauthorizedCallback(() => {
      // If we get a 401, clear user state
      setUser(null);
      setAccessToken(null);
      localStorage.removeItem("refreshToken");
    });

    const initAuth = async () => {
      try {
        // Try refreshing token on mount
        const res = await api.auth.refresh();
        if (mounted) {
          setAccessToken(res.accessToken);
          localStorage.setItem("refreshToken", res.refreshToken);
          setUser(res.user);
        }
      } catch (err) {
        // Expected if no refresh token or invalid
        if (mounted) {
          setUser(null);
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    initAuth();

    return () => {
      mounted = false;
    };
  }, []);

  const login = (token: string, refreshToken: string, newUser: AuthUser) => {
    setAccessToken(token);
    localStorage.setItem("refreshToken", refreshToken);
    setUser(newUser);
  };

  const logout = async () => {
    try {
      await api.auth.logout();
    } catch (e) {
      // Ignore errors on logout
    }
    setAccessToken(null);
    localStorage.removeItem("refreshToken");
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
