"use client";

import { ReactNode, useEffect } from "react";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";

function AuthBootstrap({ children }: { children: ReactNode }) {
  const { refresh } = useAuth();

  useEffect(() => {
    refresh();
  }, [refresh]);

  return <>{children}</>;
}

export function Providers({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <AuthBootstrap>{children}</AuthBootstrap>
    </AuthProvider>
  );
}
