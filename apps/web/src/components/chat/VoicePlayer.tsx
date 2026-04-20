import { useState, useRef, useEffect } from 'react'
import { Play, Pause, Volume2, AlertCircle } from 'lucide-react'

interface VoicePlayerProps {
    src: string
    duration?: number
}

export default function VoicePlayer({ src, duration: initialDuration }: VoicePlayerProps) {
    const audioRef = useRef<HTMLAudioElement>(null)
    const [isPlaying, setIsPlaying] = useState(false)
    const [currentTime, setCurrentTime] = useState(0)
    const [duration, setDuration] = useState(initialDuration || 0)
    const [isLoading, setIsLoading] = useState(!!src)
    const [error, setError] = useState<string | null>(!src ? 'Cannot load audio' : null)

    // Format time helper
    const formatTime = (time: number) => {
        if (!time || isNaN(time)) return '0:00'
        const minutes = Math.floor(time / 60)
        const seconds = Math.floor(time % 60)
        return `${minutes}:${seconds.toString().padStart(2, '0')}`
    }

    // Handle play/pause
    const togglePlayPause = () => {
        if (audioRef.current) {
            if (isPlaying) {
                audioRef.current.pause()
            } else {
                audioRef.current.play().catch(err => {
                    setError('Failed to play audio')
                    console.error('Playback error:', err)
                })
            }
        }
    }

    // Handle audio metadata loaded
    useEffect(() => {
        const audio = audioRef.current
        if (!audio) return

        const handleLoadedMetadata = () => {
            setDuration(audio.duration)
            setIsLoading(false)
        }

        const handlePlay = () => setIsPlaying(true)
        const handlePause = () => setIsPlaying(false)

        const handleTimeUpdate = () => setCurrentTime(audio.currentTime)

        const handleEnded = () => {
            setIsPlaying(false)
            setCurrentTime(0)
        }

        const handleError = () => {
            setError('Cannot load audio')
            setIsLoading(false)
        }

        audio.addEventListener('loadedmetadata', handleLoadedMetadata)
        audio.addEventListener('play', handlePlay)
        audio.addEventListener('pause', handlePause)
        audio.addEventListener('timeupdate', handleTimeUpdate)
        audio.addEventListener('ended', handleEnded)
        audio.addEventListener('error', handleError)

        return () => {
            audio.removeEventListener('loadedmetadata', handleLoadedMetadata)
            audio.removeEventListener('play', handlePlay)
            audio.removeEventListener('pause', handlePause)
            audio.removeEventListener('timeupdate', handleTimeUpdate)
            audio.removeEventListener('ended', handleEnded)
            audio.removeEventListener('error', handleError)
        }
    }, [])

    // Handle progress bar click
    const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
        if (!audioRef.current) return
        const progressBar = e.currentTarget
        const rect = progressBar.getBoundingClientRect()
        const percent = (e.clientX - rect.left) / rect.width
        const newTime = percent * duration
        audioRef.current.currentTime = newTime
    }

    if (error) {
        return (
            <div className="flex items-center gap-2 p-2 bg-red-50 dark:bg-red-950/20 rounded-lg">
                <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
                <span className="text-xs text-red-600 dark:text-red-400">{error}</span>
            </div>
        )
    }

    const progress = duration > 0 ? (currentTime / duration) * 100 : 0

    return (
        <div className="flex items-center gap-2 max-w-[250px]">
            {/* Hidden audio element */}
            <audio
                ref={audioRef}
                src={src}
                onCanPlay={() => setIsLoading(false)}
            />

            {/* Play/Pause button */}
            <button
                onClick={togglePlayPause}
                disabled={isLoading || error !== null}
                className="p-2 rounded-full bg-primary-500 hover:bg-primary-600 disabled:bg-gray-400 disabled:cursor-not-allowed text-white transition-colors flex-shrink-0"
                title={isPlaying ? 'Pause' : 'Play'}
            >
                {isLoading ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : isPlaying ? (
                    <Pause className="w-4 h-4" />
                ) : (
                    <Play className="w-4 h-4 ml-0.5" />
                )}
            </button>

            {/* Progress bar */}
            <div
                onClick={handleProgressClick}
                className="flex-1 flex items-center gap-1 cursor-pointer"
            >
                <div className="flex-1 h-1 bg-gray-300 dark:bg-gray-600 rounded-full overflow-hidden">
                    <div
                        className="h-full bg-primary-500 rounded-full transition-all"
                        style={{ width: `${progress}%` }}
                    />
                </div>
            </div>

            {/* Volume indicator and time */}
            <div className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400 flex-shrink-0">
                <Volume2 className="w-3 h-3" />
                <span>{formatTime(currentTime)} / {formatTime(duration)}</span>
            </div>
        </div>
    )
}
