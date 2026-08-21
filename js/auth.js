/**
 * Authentication. Wraps supabase.auth so views never touch it directly.
 *
 * Note on roles: nothing here grants anything. `loadProfile` reads the role the
 * database assigned, and the UI uses it to decide what to *show*. Whether an
 * action succeeds is decided by RLS, server-side, every time.
 */
import { supabase } from './supabase.js';

export async function getSession() {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  return data.session;
}

export function onAuthStateChange(handler) {
  const { data } = supabase.auth.onAuthStateChange((event, session) => {
    handler(event, session);
  });
  return () => data.subscription.unsubscribe();
}

export async function signIn(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

export async function signUp(email, password, fullName) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      // handle_new_user() reads full_name out of raw_user_meta_data when it
      // creates the profile row.
      data: { full_name: fullName },
      emailRedirectTo: window.location.origin + window.location.pathname,
    },
  });
  if (error) throw error;

  // With email confirmation on, Supabase returns a user but no session.
  const needsConfirmation = Boolean(data.user) && !data.session;
  return { ...data, needsConfirmation };
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

/** The signed-in user's profile row, including the role the database gave them. */
export async function loadProfile(userId) {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, email, full_name, role, is_approved, created_at')
    .eq('id', userId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

/**
 * All profiles. RLS returns only the caller's own row unless they are an admin,
 * so a member calling this simply gets a one-row list rather than an error.
 */
export async function loadTeam() {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, email, full_name, role, is_approved, created_at')
    .order('created_at');
  if (error) throw error;
  return data ?? [];
}

export async function setRole(userId, role) {
  const { data, error } = await supabase
    .from('profiles')
    .update({ role })
    .eq('id', userId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

/**
 * Approve or revoke an account's access to the record.
 *
 * A member calling this is refused by the database, not by the absence of a
 * button — the guard trigger on profiles rejects any approval change from a
 * non-admin.
 */
export async function setApproval(userId, isApproved) {
  const { data, error } = await supabase
    .from('profiles')
    .update({ is_approved: isApproved })
    .eq('id', userId)
    .select()
    .single();
  if (error) throw error;
  return data;
}
