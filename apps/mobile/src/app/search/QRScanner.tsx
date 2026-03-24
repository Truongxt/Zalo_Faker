import { useState, useEffect } from "react";
import {
  Text,
  View,
  Button,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import {
  CameraView,
  scanFromURLAsync,
  useCameraPermissions,
} from "expo-camera";
import * as ImagePicker from "expo-image-picker";

export default function QRScanner() {
  const router = useRouter();
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [isPickingImage, setIsPickingImage] = useState(false);

  useEffect(() => {
    const getPermission = async () => {
      await requestPermission();
    };

    getPermission();
  }, [requestPermission]);

  const navigateByQrData = (data: string) => {
    setScanned(true);

    const matched = /^userId:(.+)$/.exec(data.trim());
    if (!matched?.[1]) {
      alert("Mã QR không hợp lệ");
      return;
    }

    const userId = matched[1];
    router.replace({
      pathname: "/friends/UserSearchResult",
      params: { userId: String(userId) },
    });
  };

  const handleBarCodeScanned = ({ data }: { type: string; data: string }) => {
    navigateByQrData(data);
  };

  const handlePickImageAndScan = async () => {
    if (isPickingImage) return;

    try {
      setIsPickingImage(true);

      const mediaPermission =
        await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (!mediaPermission.granted) {
        alert("Bạn cần cấp quyền thư viện ảnh để quét QR từ ảnh.");
        return;
      }

      const picked = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: false,
        quality: 1,
      });

      if (picked.canceled || !picked.assets?.[0]?.uri) {
        return;
      }

      const scannedResults = await scanFromURLAsync(picked.assets[0].uri, [
        "qr",
      ]);
      if (!scannedResults.length) {
        alert("Không tìm thấy mã QR trong ảnh.");
        return;
      }

      navigateByQrData(scannedResults[0].data);
    } catch (error) {
      console.error("Scan QR from gallery failed:", error);
      alert("Không thể quét QR từ ảnh. Vui lòng thử lại.");
    } finally {
      setIsPickingImage(false);
    }
  };

  if (!permission) {
    return <Text>Đang xin quyền camera...</Text>;
  }

  if (!permission.granted) {
    return <Text>Không có quyền truy cập camera</Text>;
  }

  return (
    <View style={styles.container}>
      <CameraView
        facing="back"
        barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
        onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
        style={StyleSheet.absoluteFillObject}
      />

      <View style={styles.actionsContainer}>
        <TouchableOpacity
          style={[styles.actionButton, isPickingImage && styles.disabledButton]}
          onPress={handlePickImageAndScan}
          activeOpacity={0.8}
          disabled={isPickingImage}
        >
          {isPickingImage ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.actionButtonText}>Chọn ảnh từ thư viện</Text>
          )}
        </TouchableOpacity>

        {scanned && (
          <View style={styles.rescanButtonWrap}>
            <Button title="Quét lại" onPress={() => setScanned(false)} />
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  actionsContainer: {
    position: "absolute",
    left: 16,
    right: 16,
    bottom: 24,
    gap: 12,
  },
  actionButton: {
    backgroundColor: "#0068FF",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  disabledButton: {
    opacity: 0.75,
  },
  actionButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  rescanButtonWrap: {
    backgroundColor: "rgba(255, 255, 255, 0.92)",
    borderRadius: 12,
    overflow: "hidden",
  },
});
