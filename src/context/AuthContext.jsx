import { createContext, useMemo, useState } from "react";

const AuthContext = createContext(null);

const getInitialUser = () => {
  const cached = localStorage.getItem("pc_user");

  if (!cached) {
    return null;
  }

  try {
    return JSON.parse(cached);
  } catch {
    return null;
  }
};

export function AuthProvider({ children }) {
  const [user, setUser] = useState(getInitialUser);
  const [token, setToken] = useState(localStorage.getItem("pc_token"));

  const login = (payload) => {
    setToken(payload.accessToken);
    setUser(payload.user);

    localStorage.setItem("pc_token", payload.accessToken);
    localStorage.setItem("pc_user", JSON.stringify(payload.user));
    window.dispatchEvent(
      new CustomEvent("pc_auth_change", { detail: { user: payload.user } }),
    );
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem("pc_token");
    localStorage.removeItem("pc_user");
    window.dispatchEvent(
      new CustomEvent("pc_auth_change", { detail: { user: null } }),
    );
  };

  const value = useMemo(
    () => ({
      user,
      token,
      isAuthenticated: Boolean(token),
      login,
      logout,
    }),
    [user, token],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export { AuthContext };
