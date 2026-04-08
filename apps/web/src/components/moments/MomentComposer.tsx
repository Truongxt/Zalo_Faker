import { useEffect, useRef, useState } from 'react';
import { Image as ImageIcon, Loader2, Send, Video, X } from 'lucide-react';
import type { MomentMediaFile } from '@/services/momentService';
import { useAuthStore } from '@/stores/authStore';

interface MomentComposerProps {
  onPost: (content: string, mediaFiles: MomentMediaFile[]) => Promise<void>;
  isPosting: boolean;
}

type ComposerMediaItem = {
  id: string;
  file: File;
  url: string;
  type: 'image' | 'video';
};

const MAX_MEDIA_ITEMS = 10;

const revokeMediaUrls = (items: ComposerMediaItem[]) => {
  items.forEach((item) => URL.revokeObjectURL(item.url));
};

export default function MomentComposer({
  onPost,
  isPosting,
}: MomentComposerProps) {
  const { user } = useAuthStore();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaRef = useRef<ComposerMediaItem[]>([]);
  const [content, setContent] = useState('');
  const [mediaItems, setMediaItems] = useState<ComposerMediaItem[]>([]);

  useEffect(() => {
    mediaRef.current = mediaItems;
  }, [mediaItems]);

  useEffect(() => () => revokeMediaUrls(mediaRef.current), []);

  const canPost = Boolean(content.trim() || mediaItems.length > 0) && !isPosting;

  const handleMediaChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    if (!files.length) {
      return;
    }

    setMediaItems((prev) => {
      const nextItems = files.map((file, index) => ({
        id: `new-${Date.now()}-${index}-${file.name}-${file.lastModified}`,
        file,
        url: URL.createObjectURL(file),
        type: (file.type.startsWith('video/') ? 'video' : 'image') as
          | 'image'
          | 'video',
      }));

      const merged = [...prev, ...nextItems];
      const deduped: ComposerMediaItem[] = [];

      merged.forEach((item) => {
        const exists = deduped.some(
          (candidate) =>
            candidate.file.name === item.file.name &&
            candidate.file.lastModified === item.file.lastModified,
        );

        if (!exists && deduped.length < MAX_MEDIA_ITEMS) {
          deduped.push(item);
          return;
        }

        if (!prev.some((candidate) => candidate.id === item.id)) {
          URL.revokeObjectURL(item.url);
        }
      });

      return deduped;
    });

    event.target.value = '';
  };

  const handleRemoveMedia = (mediaId: string) => {
    setMediaItems((prev) => {
      const target = prev.find((item) => item.id === mediaId);
      if (target) {
        URL.revokeObjectURL(target.url);
      }

      return prev.filter((item) => item.id !== mediaId);
    });
  };

  const handleSubmit = async () => {
    if (!canPost) {
      return;
    }

    const submitMedia = mediaItems.map((item) => ({ file: item.file }));
    await onPost(content.trim(), submitMedia);

    revokeMediaUrls(mediaItems);
    setContent('');
    setMediaItems([]);
  };

  return (
    <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-dark-200">
      <div className="flex gap-4">
        {user?.avatarUrl ? (
          <img
            src={user.avatarUrl}
            alt={user.fullName}
            className="h-10 w-10 shrink-0 rounded-full object-cover"
          />
        ) : (
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-100 dark:bg-primary-900/30">
            <span className="text-sm font-medium text-primary-600 dark:text-primary-400">
              {user?.fullName?.charAt(0).toUpperCase() || 'U'}
            </span>
          </div>
        )}

        <div className="min-w-0 flex-1">
          <textarea
            value={content}
            onChange={(event) => setContent(event.target.value)}
            placeholder={`${
              user?.fullName?.split(' ').pop() || 'B\u1ea1n'
            } \u01a1i, h\u00f4m nay b\u1ea1n th\u1ea5y th\u1ebf n\u00e0o?`}
            className="w-full resize-none rounded-xl bg-gray-50 p-3 text-sm text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-primary-500 dark:bg-dark-300 dark:text-white"
            rows={content ? 3 : 2}
          />

          {mediaItems.length > 0 ? (
            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
              {mediaItems.map((item) => (
                <div
                  key={item.id}
                  className="relative overflow-hidden rounded-2xl bg-gray-100 dark:bg-dark-300"
                >
                  {item.type === 'video' ? (
                    <video
                      src={item.url}
                      className="h-56 w-full object-cover"
                      controls
                      playsInline
                      preload="metadata"
                    />
                  ) : (
                    <img
                      src={item.url}
                      alt="Moment media preview"
                      className="h-56 w-full object-cover"
                    />
                  )}

                  <button
                    type="button"
                    onClick={() => handleRemoveMedia(item.id)}
                    className="absolute right-3 top-3 rounded-full bg-black/60 p-2 text-white transition hover:bg-black/80"
                    title="X\u00f3a media"
                  >
                    <X className="h-4 w-4" />
                  </button>

                  <div className="absolute bottom-3 left-3 rounded-full bg-black/60 px-3 py-1 text-xs font-semibold text-white">
                    {item.type === 'video' ? 'Video' : '\u1ea2nh'}
                  </div>
                </div>
              ))}
            </div>
          ) : null}

          <div className="mt-3 flex items-center justify-between">
            <div className="flex gap-2">
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleMediaChange}
                accept="image/*,video/*"
                multiple
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm text-gray-600 transition-colors hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-dark-300"
              >
                <ImageIcon className="h-4 w-4 text-green-500" />
                <Video className="h-4 w-4 text-blue-500" />
                <span>
                  {mediaItems.length > 0 ? 'Th\u00eam media' : '\u1ea2nh/Video'}
                </span>
              </button>
            </div>

            <button
              onClick={handleSubmit}
              disabled={!canPost}
              className={`flex items-center gap-2 rounded-lg px-4 py-1.5 text-sm font-medium transition-colors ${
                canPost
                  ? 'bg-primary-500 text-white hover:bg-primary-600'
                  : 'cursor-not-allowed bg-primary-500/50 text-white/80'
              }`}
            >
              {isPosting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
              <span>\u0110\u0103ng</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
