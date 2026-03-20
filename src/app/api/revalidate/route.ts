import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';

export async function POST(req: NextRequest) {
  try {
    const { secret, path } = await req.json();
    const cronSecret = process.env.CRON_SECRET;
    if (!cronSecret || secret !== cronSecret) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }
    revalidatePath(path || '/feed');
    revalidatePath('/hot');
    return NextResponse.json({ revalidated: true, path: path || '/feed' });
  } catch {
    return NextResponse.json({ error: 'failed' }, { status: 500 });
  }
}
