import { describe, it, expect } from 'vitest';
import { PostCreateSchema, CommentCreateSchema, parseBody } from '@/lib/validations';

describe('PostCreateSchema', () => {
  it('validates valid post', () => {
    const result = PostCreateSchema.safeParse({
      title: '테스트 제목입니다',
      content: '테스트 내용이 여기에 들어갑니다.',
      category: 'free',
    });
    expect(result.success).toBe(true);
  });

  it('rejects short title', () => {
    const result = PostCreateSchema.safeParse({
      title: '짧',
      content: '내용은 충분합니다',
      category: 'free',
    });
    expect(result.success).toBe(false);
  });

  it('rejects invalid category', () => {
    const result = PostCreateSchema.safeParse({
      title: '정상 제목',
      content: '정상 내용입니다',
      category: 'invalid',
    });
    expect(result.success).toBe(false);
  });

  it('limits images to 5', () => {
    const result = PostCreateSchema.safeParse({
      title: '정상 제목',
      content: '정상 내용입니다',
      category: 'stock',
      images: Array(6).fill('https://example.com/img.jpg'),
    });
    expect(result.success).toBe(false);
  });
});

describe('CommentCreateSchema', () => {
  it('validates valid comment', () => {
    const result = CommentCreateSchema.safeParse({
      content: '좋은 글이네요!',
      post_id: 123,
    });
    expect(result.success).toBe(true);
  });

  it('rejects empty content', () => {
    const result = CommentCreateSchema.safeParse({
      content: '',
      post_id: 123,
    });
    expect(result.success).toBe(false);
  });

  it('rejects negative post_id', () => {
    const result = CommentCreateSchema.safeParse({
      content: '댓글',
      post_id: -1,
    });
    expect(result.success).toBe(false);
  });
});

describe('parseBody', () => {
  it('returns data on valid input', () => {
    const { data, error } = parseBody(CommentCreateSchema, { content: '테스트', post_id: 1 });
    expect(error).toBeNull();
    expect(data).toBeTruthy();
    expect(data!.post_id).toBe(1);
  });

  it('returns error on invalid input', () => {
    const { data, error } = parseBody(CommentCreateSchema, { content: '', post_id: 'abc' });
    expect(data).toBeNull();
    expect(error).toBeTruthy();
  });
});
