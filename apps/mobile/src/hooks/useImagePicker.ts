import { useState, useCallback } from "react";
import * as ImagePicker from "expo-image-picker";

interface UseImagePickerOptions {
  allowsEditing?: boolean;
  aspect?: [number, number];
  quality?: number;
}

/**
 * Hook for picking images from gallery or camera.
 */
export function useImagePicker(options: UseImagePickerOptions = {}) {
  const { allowsEditing = true, aspect = [1, 1], quality = 0.8 } = options;
  const [image, setImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const pickFromGallery = useCallback(async () => {
    setLoading(true);
    try {
      const { status } =
        await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== "granted") {
        throw new Error("Cần quyền truy cập thư viện ảnh");
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing,
        aspect,
        quality,
      });

      if (!result.canceled && result.assets[0]) {
        setImage(result.assets[0].uri);
        return result.assets[0];
      }
      return null;
    } finally {
      setLoading(false);
    }
  }, [allowsEditing, aspect, quality]);

  const pickFromCamera = useCallback(async () => {
    setLoading(true);
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== "granted") {
        throw new Error("Cần quyền truy cập camera");
      }

      const result = await ImagePicker.launchCameraAsync({
        allowsEditing,
        aspect,
        quality,
      });

      if (!result.canceled && result.assets[0]) {
        setImage(result.assets[0].uri);
        return result.assets[0];
      }
      return null;
    } finally {
      setLoading(false);
    }
  }, [allowsEditing, aspect, quality]);

  const clearImage = useCallback(() => setImage(null), []);

  return { image, loading, pickFromGallery, pickFromCamera, clearImage };
}
