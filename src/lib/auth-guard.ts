import { redirect } from 'next/navigation';
import { createClient } from './supabase/server';
import type { AppRole } from './types';

export async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, full_name, role')
    .eq('id', user.id)
    .single();

  if (!profile) {
    redirect('/login');
  }

  return { supabase, user, profile };
}

export async function requireRole(role: AppRole) {
  const context = await requireUser();
  if (context.profile.role !== role) {
    if (context.profile.role === 'admin') {
      redirect('/admin');
    }
    redirect('/judge');
  }
  return context;
}
