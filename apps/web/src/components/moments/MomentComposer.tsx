import { useState, useRef } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { Image as ImageIcon, Send, X, Loader2 } from 'lucide-react';
import { MomentImageFile } from '@/services/momentService';

interface MomentComposerProps {
  onPost: (content: string, imageFile: MomentImageFile | null) => Promise<void>;
  isPosting: boolean;
}

export default function MomentComposer({ onPost, isPosting }: MomentComposerProps) {
  const { user } = useAuthStore();
  const [content, setContent] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const canPost = content.trim().length > 0 || imageFile;

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setImageFile(file);
      setImagePreviewUrl(URL.createObjectURL(file));
    }
  };

  const removeImage = () => {
    setImageFile(null);
    if (imagePreviewUrl) {
      URL.revokeObjectURL(imagePreviewUrl);
      setImagePreviewUrl(null);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSubmit = async () => {
    if (!canPost || isPosting) return;
    
    await onPost(
      content.trim(),
      imageFile ? { file: imageFile } : null
    );

    setContent('');
    removeImage();
  };

  return (
    <div className="bg-white dark:bg-dark-200 rounded-xl p-4 shadow-sm border border-gray-100 dark:border-gray-800">
      <div className="flex gap-4">
        {user?.avatarUrl ? (
          <img src={user.avatarUrl} alt={user.fullName} className="w-10 h-10 rounded-full object-cover shrink-0" />
        ) : (
          <div className="w-10 h-10 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center shrink-0">
            <span className="text-sm font-medium text-primary-600 dark:text-primary-400">
              {user?.fullName?.charAt(0).toUpperCase() || 'U'}
            </span>
          </div>
        )}
        
        <div className="flex-1 min-w-0">
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder={`${user?.fullName?.split(' ').pop() || 'Bạn'} ơi, hôm nay bạn thấy thế nào?`}
            className="w-full bg-gray-50 dark:bg-dark-300 rounded-xl p-3 text-sm text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-primary-500 resize-none"
            rows={content ? 3 : 2}
          />
          
          {imagePreviewUrl && (
            <div className="relative mt-3 inline-block">
              <img src={imagePreviewUrl} alt="Preview" className="max-h-60 rounded-lg object-contain bg-gray-100 dark:bg-dark-300" />
              <button
                type="button"
                onClick={removeImage}
                className="absolute top-2 right-2 p-1 bg-black/50 hover:bg-black/70 rounded-full text-white transition-colors"
                title="Xóa ảnh"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}
          
          <div className="flex items-center justify-between mt-3">
            <div className="flex gap-2">
              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleImageChange} 
                accept="image/*" 
                className="hidden" 
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-dark-300 rounded-lg transition-colors"
              >
                <ImageIcon className="w-4 h-4 text-green-500" />
                <span>Ảnh</span>
              </button>
            </div>
            
            <button
              onClick={handleSubmit}
              disabled={!canPost || isPosting}
              className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                canPost && !isPosting 
                  ? 'bg-primary-500 hover:bg-primary-600 text-white' 
                  : 'bg-primary-500/50 text-white/80 cursor-not-allowed'
              }`}
            >
              {isPosting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              <span>Đăng</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
