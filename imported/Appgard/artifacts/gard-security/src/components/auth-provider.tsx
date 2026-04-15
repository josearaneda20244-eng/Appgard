import { createContext, useContext, useEffect, useState, useCallback } from "react";
  import { useGetMe, getGetMeQueryKey, setAuthTokenGetter } from "@workspace/api-client-react";
  import type { User } from "@workspace/api-client-react";

  interface AuthContextType {
    user: User | null;
    token: string | null;
    login: (token: string, user: User) => void;
    logout: () => void;
    isLoading: boolean;
  }

  const AuthContext = createContext<AuthContextType | null>(null);

  export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [token, setToken] = useState<string | null>(localStorage.getItem("token"));
    const [user, setUser] = useState<User | null>(null);

    useEffect(() => {
      setAuthTokenGetter(() => token);
    }, [token]);

    const { data: me, isLoading, error } = useGetMe({
      query: {
        enabled: !!token,
        retry: 4,
        retryDelay: (attempt) => Math.min(2000 * (attempt + 1), 10000),
        queryKey: getGetMeQueryKey(),
      },
    });

    useEffect(() => {
      if (me) {
        setUser(me);
      }
      if (error) {
        setToken(null);
        setUser(null);
        localStorage.removeItem("token");
      }
    }, [me, error]);

    const login = useCallback((newToken: string, newUser: User) => {
      setToken(newToken);
      setUser(newUser);
      localStorage.setItem("token", newToken);
    }, []);

    const logout = useCallback(() => {
      setToken(null);
      setUser(null);
      localStorage.removeItem("token");
    }, []);

    return (
      <AuthContext.Provider value={{ user, token, login, logout, isLoading: isLoading && !!token }}>
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
  