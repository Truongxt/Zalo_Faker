import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Audio, type AVPlaybackStatus } from "expo-av";

type VoiceMessagePlayerProps = {
  audioUrl: string;
  durationSeconds?: number;
  textColor: string;
  controlBackgroundColor?: string;
  trackColor?: string;
  onPressMessage?: () => void;
};

const formatAudioTime = (millis: number) => {
  const totalSeconds = Math.max(0, Math.floor((millis || 0) / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
};

export function VoiceMessagePlayer({
  audioUrl,
  durationSeconds,
  textColor,
  controlBackgroundColor = "rgba(255,255,255,0.25)",
  trackColor = "rgba(255,255,255,0.35)",
  onPressMessage,
}: VoiceMessagePlayerProps) {
  const soundRef = useRef<Audio.Sound | null>(null);
  const mountedRef = useRef(true);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [positionMillis, setPositionMillis] = useState(0);
  const [durationMillis, setDurationMillis] = useState(
    durationSeconds && durationSeconds > 0 ? durationSeconds * 1000 : 0,
  );
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      const sound = soundRef.current;
      soundRef.current = null;
      if (sound) {
        sound.unloadAsync().catch(() => null);
      }
    };
  }, []);

  const updateStatus = useCallback((status: AVPlaybackStatus) => {
    if (!mountedRef.current) return;

    if (!status.isLoaded) {
      if ((status as any).error) {
        setHasError(true);
        setIsLoading(false);
      }
      return;
    }

    setHasError(false);
    setIsPlaying(Boolean(status.isPlaying));
    setPositionMillis(status.positionMillis || 0);
    if (
      typeof status.durationMillis === "number" &&
      status.durationMillis > 0
    ) {
      setDurationMillis(status.durationMillis);
    }
    if (status.didJustFinish) {
      setIsPlaying(false);
      setPositionMillis(0);
    }
  }, []);

  const ensureLoadedSound = useCallback(async () => {
    if (soundRef.current) return soundRef.current;

    await Audio.setAudioModeAsync({
      allowsRecordingIOS: false,
      playsInSilentModeIOS: true,
      shouldDuckAndroid: true,
      playThroughEarpieceAndroid: false,
      staysActiveInBackground: false,
    });

    const sound = new Audio.Sound();
    sound.setOnPlaybackStatusUpdate(updateStatus);
    await sound.loadAsync(
      { uri: audioUrl },
      { shouldPlay: false, progressUpdateIntervalMillis: 200 },
    );
    soundRef.current = sound;
    return sound;
  }, [audioUrl, updateStatus]);

  const togglePlayPause = useCallback(async () => {
    if (isLoading || hasError) return;

    try {
      setIsLoading(true);
      const sound = await ensureLoadedSound();
      const status = await sound.getStatusAsync();
      if (!status.isLoaded) {
        setHasError(true);
        return;
      }

      if (status.isPlaying) {
        await sound.pauseAsync();
      } else {
        await sound.playAsync();
      }
    } catch (error) {
      console.error("Khong the phat voice:", error);
      setHasError(true);
    } finally {
      if (mountedRef.current) setIsLoading(false);
    }
  }, [ensureLoadedSound, hasError, isLoading]);

  const progress =
    durationMillis > 0 ? (positionMillis / durationMillis) * 100 : 0;

  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={() => {
        onPressMessage?.();
        void togglePlayPause();
      }}
      style={{
        flexDirection: "row",
        alignItems: "center",
        width: "100%",
        minWidth: 0,
        gap: 8,
      }}
    >
      <View
        style={{
          width: 28,
          height: 28,
          borderRadius: 14,
          backgroundColor: controlBackgroundColor,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {isLoading ? (
          <ActivityIndicator size="small" color={textColor} />
        ) : (
          <Ionicons
            name={isPlaying ? "pause" : "play"}
            size={16}
            color={textColor}
          />
        )}
      </View>

      <View style={{ flex: 1 }}>
        <View
          style={{
            height: 4,
            borderRadius: 2,
            backgroundColor: trackColor,
          }}
        >
          <View
            style={{
              width: `${Math.max(0, Math.min(progress, 100))}%`,
              height: 4,
              borderRadius: 2,
              backgroundColor: textColor,
            }}
          />
        </View>
      </View>

      <Text
        style={{
          color: textColor,
          fontSize: 12,
          flexShrink: 0,
        }}
      >
        {formatAudioTime(positionMillis)} / {formatAudioTime(durationMillis)}
      </Text>

      {hasError ? (
        <Ionicons name="warning-outline" size={14} color={textColor} />
      ) : null}
    </TouchableOpacity>
  );
}
