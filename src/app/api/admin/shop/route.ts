import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';

export async function GET(req: NextRequest) {
  const auth = await requireAdmin();
  if ('error' in auth) return auth.error;
  const { admin } = auth;

  const type = new URL(req.url).searchParams.get('type');

  if (type === 'orders') {
    const { data } = await admin.from('shop_orders')
      .select('id, user_id, product_id, order_id, amount, status, method, created_at')
      .order('created_at', { ascending: false }).limit(100);
    return NextResponse.json({ orders: data || [] });
  }

  const { data } = await admin.from('shop_products')
    .select('*').order('created_at', { ascending: false });
  return NextResponse.json({ products: data || [] });
}

export async function PATCH(req: NextRequest) {
  const auth = await requireAdmin();
  if ('error' in auth) return auth.error;
  const { admin } = auth;

  const { id, is_active } = await req.json();
  if (!id) return NextResponse.json({ error: 'id 필수' }, { status: 400 });

  const { error } = await admin.from('shop_products').update({ is_active }).eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}
