import { createContext, useContext, useEffect, useMemo, useState } from "react";

const RoleContext = createContext();

export function RoleProvider({ children }) {
  const [role, setRole] = useState(() => {
    try {
      const savedUser = localStorage.getItem("sentricore_user");
      if (savedUser) {
        const parsed = JSON.parse(savedUser);
        if (parsed?.role === "operator" || parsed?.role === "admin") {
          return parsed.role;
        }
      }
    } catch {
      // Fallback
    }
    return "admin";
  });

  const user = useMemo(
    () => ({
      name: role === "admin" ? "Administrator" : "SOC Operator",
      email: role === "admin" ? "admin@sentricore.com" : "operator@sentricore.com",
      role,
    }),
    [role]
  );

  // Sync role whenever storage changes or on mount
  useEffect(() => {
    const handleStorageChange = () => {
      try {
        const savedUser = localStorage.getItem("sentricore_user");
        if (savedUser) {
          const parsed = JSON.parse(savedUser);
          if (parsed?.role === "operator" || parsed?.role === "admin") {
            setRole(parsed.role);
          }
        }
      } catch {
        // Fallback
      }
    };

    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, []);

  const loginAs = (userData) => {
    if (userData?.role === "operator" || userData?.role === "admin") {
      setRole(userData.role);
    }
  };

  const isAdmin = role === "admin";
  const isOperator = role === "operator";

  return (
    <RoleContext.Provider
      value={{
        role,
        user,
        isAdmin,
        isOperator,
        loginAs,
      }}
    >
      {children}
    </RoleContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useRole() {
  const context = useContext(RoleContext);
  if (!context) {
    throw new Error("useRole must be used within a RoleProvider");
  }
  return context;
}
