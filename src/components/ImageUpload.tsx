'use client';
import { useState, useRef } from 'react';
import { createSupabaseBrowser } from '@/lib/supabase-browser';

interface ImageUploadProps { images: string[]; onImagesChange: (images: string[]) => void; maxImages?: number; }

export default function ImageUpload({ images, onImagesChange, maxImages = 5 }: ImageUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const supabase = createSupabaseBrowser();
  const MAX_FILE_SIZE = 5 * 1024 * 1024;
  const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setError('');
    const remaining = maxImages - images.length;
    if (remaining <= 0) { setError(`이미지는 최대 ${maxImages}개까지`); return; }
    const filesToUpload = Array.from(files).slice(0, remaining);
    for (const file of filesToUpload) {
      if (!ALLOWED_TYPES.includes(file.type)) { setError('JPG, PNG, GIF, WebP만 가능'); return; }
      if (file.size > MAX_FILE_SIZE) { setError('5MB 이하만 가능'); return; }
    }
    setUploading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setError('로그인 필요'); setUploading(false); return; }
      const uploadedUrls: string[] = [];
      for (const file of filesToUpload) {
        const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
        const fileName = `${user.id}/${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;
        const { error: uploadError } = await supabase.storage.from('posts').upload(fileName, file, { cacheControl: '3600', upsert: false });
        if (uploadError) { setError(`업로드 실패: ${uploadError.message}`); continue; }
        const { data: urlData } = supabase.storage.from('posts').getPublicUrl(fileName);
        if (urlData?.publicUrl) uploadedUrls.push(urlData.publicUrl);
      }
      if (uploadedUrls.length > 0) onImagesChange([...images, ...uploadedUrls]);
    } catch { setError('이미지 업로드 중 오류'); }
    finally { setUploading(false); if (fileInputRef.current) fileInputRef.current.value = ''; }
  }

  function removeImage(index: number) { onImagesChange(images.filter((_, i) => i !== index)); }

  return (
    <div className="space-y-3">
      <label className="block text-sm font-medium text-[var(--kd-text)]/70">이미지 첨부 ({images.length}/{maxImages})</label>
      {images.length > 0 && (
        <div className="flex flex-wrap gap-3">
          {images.map((url, i) => (
            <div key={i} className="relative group w-24 h-24 rounded-xl overflow-hidden border border-[var(--kd-border)]">
              <img src={url} alt={`첨부 ${i + 1}`} className="w-full h-full object-cover" />
              <button type="button" onClick={() => removeImage(i)} className="absolute top-1 right-1 w-6 h-6 bg-black/60 text-white rounded-full flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity hover:bg-[var(--kd-danger)]" aria-label={`이미지 ${i + 1} 삭제`}>✕</button>
            </div>
          ))}
        </div>
      )}
      {images.length < maxImages && (
        <div>
          <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/gif,image/webp" multiple onChange={handleFileSelect} className="hidden" id="image-upload" />
          <label htmlFor="image-upload" className={`inline-flex items-center gap-2 px-4 py-2 border border-dashed border-[var(--kd-border)] rounded-xl text-sm text-[var(--kd-text)]/60 hover:border-[var(--kd-primary)]/50 hover:text-[var(--kd-primary)] transition-colors cursor-pointer ${uploading ? 'opacity-50 pointer-events-none' : ''}`}>
            {uploading ? (<><span className="animate-spin">⏳</span>업로드 중...</>) : (<><span>📷</span>이미지 추가 (최대 5MB)</>)}
          </label>
        </div>
      )}
      {error && <p className="text-sm text-[var(--kd-danger)]">{error}</p>}
    </div>
  );
}
