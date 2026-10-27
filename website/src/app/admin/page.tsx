import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { AdminDashboard } from '@/features/admin/AdminDashboard';
import { ADMIN_SESSION_COOKIE, checkAdminToken } from '@/features/admin/auth/admin-contract';

export default async function AdminPage() {
  const token = (await cookies()).get(ADMIN_SESSION_COOKIE)?.value;
  let allowed = false;
  try { allowed = await checkAdminToken(token); } catch { /* Fail closed on authorization outage. */ }
  if (!allowed) redirect('/admin/login');
  return <AdminDashboard />;
}
