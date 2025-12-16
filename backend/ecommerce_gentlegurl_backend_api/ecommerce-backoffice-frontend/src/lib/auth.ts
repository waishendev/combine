import { apiGet, apiPost } from './api-client';

export type AdminUser = {
  id: number;
  name: string;
  email: string;
  username: string;
  is_active: boolean;
  roles: { id: number; name: string }[];
  permissions: string[];
};

export async function loginAdmin(payload: { username: string; password: string }): Promise<AdminUser> {
  const res = await apiPost<AdminUser>('/login', payload);
  return res.data;
}

export async function logoutAdmin(): Promise<void> {
  try {
    await apiPost<null>('/logout');
  } catch {
    // ignore
  }
}

export async function fetchProfile(): Promise<AdminUser> {
  const res = await apiGet<AdminUser>('/profile');
  return res.data;
}
