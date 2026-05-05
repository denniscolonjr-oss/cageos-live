"use client";

/**
 * Auth context.
 *
 * Wraps the app and exposes:
 * - `session` — Supabase session object, or null when logged out
 * - `user` — convenience accessor for session.user
 * - `activeWorkspaceId` — which workspace the user is currently viewing
 * - `workspaces` — every workspace the user belongs to (loaded on auth)
 * - `loading` — true during initial session check; gates routing decisions
 *
 * The context is mounted at the root layout, ABOVE WorkspaceProvider, so the
 * workspace hook can decide which adapter to instantiate based on auth state.
 */

import {
  createContext, useContext, useEffect, useState, useCallback,
  type ReactNode,
} from "react";
import type { Session, User } from "@supabase/supabase-js";
import { getSupabaseClient, isSupabaseConfigured } from "./client";

const ACTIVE_WORKSPACE_KEY = "cageos:activeWorkspace:v1";

export type WorkspaceRole = "owner" | "manager" | "crew" | "viewer";

export interface WorkspaceMembership {
  id: string;          // workspace id
  name: string;        // org name
  role: WorkspaceRole;
}

interface AuthContextValue {
  loading: boolean;
  session: Session | null;
  user: User | null;
  workspaces: WorkspaceMembership[];
  activeWorkspaceId: string | null;
  setActiveWorkspaceId: (id: string | null) => void;
  /** Role of the current user in the active workspace. Null when no active workspace. */
  currentRole: WorkspaceRole | null;
  refreshWorkspaces: () => Promise<void>;
  signOut: () => Promise<void>;
  /** True when the env vars are set. Lets the app fall back to localStorage gracefully in dev. */
  supabaseEnabled: boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const supabaseEnabled = isSupabaseConfigured();
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<Session | null>(null);
  const [workspaces, setWorkspaces] = useState<WorkspaceMembership[]>([]);
  const [activeWorkspaceId, setActiveWorkspaceIdState] = useState<string | null>(null);

  const setActiveWorkspaceId = useCallback((id: string | null) => {
    setActiveWorkspaceIdState(id);
    if (typeof window !== "undefined") {
      if (id) localStorage.setItem(ACTIVE_WORKSPACE_KEY, id);
      else localStorage.removeItem(ACTIVE_WORKSPACE_KEY);
    }
  }, []);

  const refreshWorkspaces = useCallback(async () => {
    if (!supabaseEnabled) return;
    const client = getSupabaseClient();
    const { data: { session: current } }: { data: { session: Session | null } } = await client.auth.getSession();
    if (!current) {
      setWorkspaces([]);
      setActiveWorkspaceId(null);
      return;
    }

    // Pull the user's workspace memberships joined to workspace name
    const { data, error } = await client
      .from("workspace_members")
      .select("role, workspaces(id, name)")
      .eq("user_id", current.user.id);

    if (error) {
      console.error("Failed to load workspaces:", error);
      setWorkspaces([]);
      return;
    }

    const memberships: WorkspaceMembership[] = (data ?? [])
      .map((row: { role: string; workspaces: { id: string; name: string } | null }) => {
        const ws = row.workspaces;
        if (!ws) return null;
        return { id: ws.id, name: ws.name, role: row.role as WorkspaceRole };
      })
      .filter((x: WorkspaceMembership | null): x is WorkspaceMembership => x !== null);

    setWorkspaces(memberships);

    // Restore previously-active workspace if it's still in the list, else pick the first
    const stored = typeof window !== "undefined" ? localStorage.getItem(ACTIVE_WORKSPACE_KEY) : null;
    const active = memberships.find(m => m.id === stored) ?? memberships[0] ?? null;
    setActiveWorkspaceId(active?.id ?? null);
  }, [supabaseEnabled, setActiveWorkspaceId]);

  const signOut = useCallback(async () => {
    if (!supabaseEnabled) return;
    const client = getSupabaseClient();
    await client.auth.signOut();
    setSession(null);
    setWorkspaces([]);
    setActiveWorkspaceId(null);
  }, [supabaseEnabled, setActiveWorkspaceId]);

  // Initial session load + auth state change listener
  useEffect(() => {
    if (!supabaseEnabled) {
      setLoading(false);
      return;
    }

    const client = getSupabaseClient();
    let mounted = true;

    client.auth.getSession().then(({ data: { session: current } }: { data: { session: Session | null } }) => {
      if (!mounted) return;
      setSession(current);
      setLoading(false);
      if (current) refreshWorkspaces();
    });

    const { data: { subscription } } = client.auth.onAuthStateChange((_event: string, newSession: Session | null) => {
      if (!mounted) return;
      setSession(newSession);
      if (newSession) {
        refreshWorkspaces();
      } else {
        setWorkspaces([]);
        setActiveWorkspaceId(null);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [supabaseEnabled, refreshWorkspaces, setActiveWorkspaceId]);

  return (
    <AuthContext.Provider value={{
      loading, session, user: session?.user ?? null,
      workspaces, activeWorkspaceId, setActiveWorkspaceId,
      currentRole: workspaces.find(w => w.id === activeWorkspaceId)?.role ?? null,
      refreshWorkspaces, signOut, supabaseEnabled,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used inside <AuthProvider>. Mount it in app/layout.tsx.");
  }
  return ctx;
}
