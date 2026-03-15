import { useState, useEffect } from "react";
import { Text, View, Button, StyleSheet } from "react-native";
import { type Href, useRouter } from "expo-router";
import { BarCodeScanner } from "expo-barcode-scanner";

export default function QRScanner() {
  const router = useRouter();
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [scanned, setScanned] = useState(false);

  useEffect(() => {
    const getPermission = async () => {
      const { status } = await BarCodeScanner.requestPermissionsAsync();
      setHasPermission(status === "granted");
    };

    getPermission();
  }, []);

  const handleBarCodeScanned = ({ data }: { type: string; data: string }) => {
    setScanned(true);

    const matched = /^userId:(.+)$/.exec(data.trim());
    if (!matched?.[1]) {
      alert("Mã QR không hợp lệ");
      return;
    }

    const userId = matched[1];
    router.replace(
      `/friends/UserSearchResult?userId=${encodeURIComponent(userId)}` as Href,
    );
  };

  if (hasPermission === null) {
    return <Text>Đang xin quyền camera...</Text>;
  }

  if (hasPermission === false) {
    return <Text>Không có quyền truy cập camera</Text>;
  }

  return (
    <View style={styles.container}>
      <BarCodeScanner
        onBarCodeScanned={scanned ? undefined : handleBarCodeScanned}
        style={StyleSheet.absoluteFillObject}
      />

      {scanned && <Button title="Quét lại" onPress={() => setScanned(false)} />}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
