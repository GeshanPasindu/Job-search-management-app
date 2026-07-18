import { useState } from "react";
import { api } from "../api";
import { useAuth } from "../hooks/useAuth";

export function LoginPage({ onNavigateToRegister }: { onNavigateToRegister: () => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await api.auth.login({ email, password });
      login(res.accessToken, res.refreshToken, res.user);
    } catch (err: any) {
      setError(err.message || "Failed to login");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <div className="brand auth-brand">
          <span>JS</span>
          <div>
            <strong>Job Search Assistant</strong>
            <small>Sign in to your account</small>
          </div>
        </div>

        {error && <div className="alert error">{error}</div>}

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="form-group">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
          </div>
          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
            />
          </div>
          <button 
            type="submit" 
            className="primary block" 
            disabled={loading}
            style={{ 
              backgroundColor: "var(--blue)", 
              color: "white", 
              padding: "16px 24px", 
              fontSize: "1.1rem",
              minHeight: "56px",
              border: "none",
              borderRadius: "50px"
            }}
          >
            {loading ? "Signing in..." : "Sign in"}
          </button>
        </form>

        <p className="auth-footer">
          Don't have an account?{" "}
          <span 
            onClick={onNavigateToRegister}
            style={{ 
              textDecoration: "underline", 
              cursor: "pointer", 
              color: "var(--blue)" 
            }}
          >
            Register
          </span>
        </p>
      </div>
    </div>
  );
}
