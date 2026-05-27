import { createContext, useMemo, useState } from "react";

const AuthContext = createContext(null);

const TOKEN_KEY = "pc_token";
const USER_KEY = "pc_user";

const getInitialUser = () => {
  const sessionUser = sessionStorage.getItem(USER_KEY);
  const localUser = localStorage.getItem(USER_KEY);
  const cached = sessionUser ?? localUser;

  if (!cached) {
    return null;
  }

  try {
    const parsed = JSON.parse(cached);

    if (!sessionUser && parsed?.role === "MESA") {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(USER_KEY);
      return null;
    }

    return parsed;
  } catch {
    if (sessionUser) {
      sessionStorage.removeItem(TOKEN_KEY);
      sessionStorage.removeItem(USER_KEY);
    } else {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(USER_KEY);
    }

    return null;
  }
};

export function AuthProvider({ children }) {
  const [user, setUser] = useState(getInitialUser);
  const [token, setToken] = useState(
    sessionStorage.getItem(TOKEN_KEY) ?? localStorage.getItem(TOKEN_KEY),
  );

  const login = (payload, options = {}) => {
    const storage = options.persist === "session" ? sessionStorage : localStorage;
    const otherStorage =
      options.persist === "session" ? localStorage : sessionStorage;

    setToken(payload.accessToken);
    setUser(payload.user);

    storage.setItem(TOKEN_KEY, payload.accessToken);
    storage.setItem(USER_KEY, JSON.stringify(payload.user));
    otherStorage.removeItem(TOKEN_KEY);
    otherStorage.removeItem(USER_KEY);

    window.dispatchEvent(
      new CustomEvent("pc_auth_change", { detail: { user: payload.user } }),
    );
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    sessionStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(USER_KEY);

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
