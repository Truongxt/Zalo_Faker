import { useEffect, useMemo, useRef, useState } from 'react';
import { Image as ImageIcon, Loader2, Video, X } from 'lucide-react';
import { Moment } from '@/types/moment';
import type {
  MomentMediaFile,
  UpdateMomentPayload,
} from '@/services/momentService';
import { isVideoUrl } from './momentHelpers';

interface MomentEditModalProps {
  moment: Moment | null;
  isSaving: boolean;
  onClose: () => void;
  onSave: (payload: UpdateMomentPayload) => Promise<void>;
}

type EditableWebMedia =
  | {
      id: string;
      existing: true;
      url: string;
      type: 'image' | 'video';
    }
  | {
      id: string;
      existing: false;
      url: string;
      file: File;
      type: 'image' | 'video';
    };

const mapMomentMediaToEditable = (
  url: string,
  index: number,
): EditableWebMedia => ({
  id: `existing-${index}-${url}`,
  existing: true,
  url,
  type: isVideoUrl(url) ? 'video' : 'image',
});

const mapFileToEditable = (file: File, index: number): EditableWebMedia => ({
  id: `new-${index}-${file.name}-${file.lastModified}`,
  existing: false,
  url: URL.createObjectURL(file),
  file,
  type: file.type.startsWith('video/') ? 'video' : 'image',
});

const revokeNewMediaUrls = (mediaItems: EditableWebMedia[]) => {
  mediaItems.forEach((media) => {
    if (!media.existing) {
      URL.revokeObjectURL(media.url);
    }
  });
};

export default function MomentEditModal({
  moment,
  isSaving,
  onClose,
  onSave,
}: MomentEditModalProps) {
  const [content, setContent] = useState('');
  const [mediaItems, setMediaItems] = useState<EditableWebMedia[]>([]);
  const mediaItemsRef = useRef<EditableWebMedia[]>([]);

  useEffect(() => {
    setContent(moment?.content || '');
    setMediaItems(moment ? moment.mediaUrls.map(mapMomentMediaToEditable) : []);
  }, [moment]);

  useEffect(() => {
    mediaItemsRef.current = mediaItems;
  }, [mediaItems]);

  useEffect(() => () => revokeNewMediaUrls(mediaItemsRef.current), []);

  const canSave = useMemo(
    () => Boolean(content.trim() || mediaItems.length > 0) && !isSaving,
    [content, isSaving, mediaItems.length],
  );

  if (!moment) {
    return null;
  }

  const handleAddMedia = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    if (!files.length) {
      return;
    }

    setMediaItems((prev) => {
      const appended = files.map((file, index) => mapFileToEditable(file, index));
      const deduped = [...prev, ...appended].filter(
        (item, index, list) =>
          list.findIndex((candidate) => candidate.url === item.url) === index,
      );
      return deduped.slice(0, 10);
    });

    event.target.value = '';
  };

  const handleRemoveMedia = (mediaId: string) => {
    setMediaItems((prev) => {
      const target = prev.find((media) => media.id === mediaId);
      if (target && !target.existing) {
        URL.revokeObjectURL(target.url);
      }
      return prev.filter((media) => media.id !== mediaId);
    });
  };

  const handleClose = () => {
    revokeNewMediaUrls(mediaItems);
    onClose();
  };

  const handleSubmit = async () => {
    if (!canSave) {
      return;
    }

    const retainMediaUrls = mediaItems
      .filter(
        (media): media is Extract<EditableWebMedia, { existing: true }> =>
          media.existing,
      )
      .map((media) => media.url);

    const mediaFiles: MomentMediaFile[] = mediaItems
      .filter(
        (media): media is Extract<EditableWebMedia, { existing: false }> =>
          !media.existing,
      )
      .map((media) => ({ file: media.file }));

    await onSave({
      content: content.trim(),
      retainMediaUrls,
      mediaFiles,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 px-4 py-6">
      <div className="flex max-h-full w-full max-w-3xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl dark:bg-dark-200">
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4 dark:border-gray-800">
          <div>
            <h3 className="text-lg font-bold text-gray-900 dark:text-white">
              Chỉnh sửa khoảnh khắc
            </h3>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Bạn có thể đổi caption, xóa media cũ hoặc thêm media mới.
            </p>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="rounded-full p-2 text-gray-500 transition-colors hover:bg-gray-100 dark:hover:bg-dark-300"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="overflow-y-auto px-6 py-5">
          <textarea
            value={content}
            onChange={(event) => setContent(event.target.value)}
            placeholder="Cập nhật nội dung bài viết..."
            className="min-h-[140px] w-full resize-none rounded-3xl bg-gray-50 px-4 py-4 text-sm text-gray-900 outline-none ring-1 ring-transparent transition focus:ring-primary-500 dark:bg-dark-300 dark:text-white"
          />

          {mediaItems.length > 0 ? (
            <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-2">
              {mediaItems.map((media) => (
                <div
                  key={media.id}
                  className="relative overflow-hidden rounded-3xl bg-gray-100 dark:bg-dark-300"
                >
                  {media.type === 'video' ? (
                    <video
                      src={media.url}
                      className="h-64 w-full object-cover"
                      controls
                      playsInline
                      preload="metadata"
                    />
                  ) : (
                    <img
                      src={media.url}
                      alt="Moment media"
                      className="h-64 w-full object-cover"
                    />
                  )}

                  <button
                    type="button"
                    onClick={() => handleRemoveMedia(media.id)}
                    className="absolute right-3 top-3 rounded-full bg-black/60 p-2 text-white transition-colors hover:bg-black/80"
                    title="Xóa media"
                  >
                    <X className="h-4 w-4" />
                  </button>

                  <div className="absolute bottom-3 left-3 rounded-full bg-black/60 px-3 py-1 text-xs font-semibold text-white">
                    {media.existing
                      ? media.type === 'video'
                        ? 'Video hiện tại'
                        : 'Ảnh hiện tại'
                      : media.type === 'video'
                        ? 'Video mới'
                        : 'Ảnh mới'}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="mt-5 rounded-3xl border border-dashed border-gray-300 bg-gray-50 px-4 py-8 text-center text-sm text-gray-500 dark:bg-dark-300 dark:text-gray-400">
              Chưa còn media nào. Bạn có thể lưu chỉ với caption hoặc thêm media mới.
            </div>
          )}

          <label className="mt-5 inline-flex cursor-pointer items-center gap-2 rounded-full bg-primary-50 px-4 py-2.5 text-sm font-semibold text-primary-600 transition hover:bg-primary-100 dark:bg-primary-900/20 dark:text-primary-300">
            <ImageIcon className="h-4 w-4" />
            <Video className="h-4 w-4" />
            Thêm ảnh/video
            <input
              type="file"
              accept="image/*,video/*"
              multiple
              onChange={handleAddMedia}
              className="hidden"
            />
          </label>
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-gray-200 px-6 py-4 dark:border-gray-800">
          <button
            type="button"
            onClick={handleClose}
            className="rounded-full px-5 py-2.5 text-sm font-semibold text-gray-600 transition hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-dark-300"
          >
            Hủy
          </button>
          <button
            type="button"
            onClick={() => void handleSubmit()}
            disabled={!canSave}
            className={`inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold text-white transition ${
              canSave
                ? 'bg-primary-500 hover:bg-primary-600'
                : 'cursor-not-allowed bg-primary-300'
            }`}
          >
            {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {isSaving ? 'Đang lưu...' : 'Lưu thay đổi'}
          </button>
        </div>
      </div>
    </div>
  );
}
