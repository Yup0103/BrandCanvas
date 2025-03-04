import React, { useState, useEffect, useRef } from 'react';
import { fabric } from 'fabric';
import {
    Play,
    Pause,
    Volume2,
    VolumeX,
    SkipBack,
    SkipForward,
    Maximize,
    Minimize
} from 'lucide-react';
import { Slider } from '@/components/ui/slider';
import { Button } from '@/components/ui/button';

interface MediaPlayerProps {
    mediaObject: fabric.Object & { mediaElement?: HTMLVideoElement | HTMLAudioElement };
    canvas: fabric.Canvas | null;
    type: 'video' | 'audio';
}

// Add a new component for the timeline preview
interface TimelinePreviewProps {
    currentTime: number;
    duration: number;
    onSeek: (value: number) => void;
}

const TimelinePreview: React.FC<TimelinePreviewProps> = ({ currentTime, duration, onSeek }) => {
    const timelineRef = useRef<HTMLDivElement>(null);

    const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
        if (!timelineRef.current) return;

        const rect = timelineRef.current.getBoundingClientRect();
        const clickPosition = (e.clientX - rect.left) / rect.width;
        const newTime = clickPosition * duration;
        onSeek(newTime);
    };

    return (
        <div
            ref={timelineRef}
            className="w-full h-6 bg-gray-700/50 rounded cursor-pointer relative mb-2"
            onClick={handleClick}
        >
            {/* Progress bar */}
            <div
                className="absolute top-0 left-0 bottom-0 bg-purple-600/70 rounded-l"
                style={{ width: `${(currentTime / duration) * 100}%` }}
            />

            {/* Time markers */}
            <div className="absolute top-0 left-0 bottom-0 right-0 flex justify-between px-2">
                {[0, 0.25, 0.5, 0.75, 1].map((marker) => (
                    <div key={marker} className="h-full flex flex-col justify-end">
                        <div className="w-px h-2 bg-gray-400/30" />
                    </div>
                ))}
            </div>

            {/* Current time indicator */}
            <div
                className="absolute top-0 bottom-0 w-px bg-white"
                style={{ left: `${(currentTime / duration) * 100}%` }}
            >
                <div className="w-3 h-3 bg-white rounded-full -ml-1.5 -mt-1.5" />
            </div>
        </div>
    );
};

const MediaPlayer: React.FC<MediaPlayerProps> = ({ mediaObject, canvas, type }) => {
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [volume, setVolume] = useState(1);
    const [isMuted, setIsMuted] = useState(false);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const playerRef = useRef<HTMLDivElement>(null);
    const animationRef = useRef<number | null>(null);

    useEffect(() => {
        if (!mediaObject || !mediaObject.mediaElement) return;

        const mediaElement = mediaObject.mediaElement;

        // Set initial values
        setCurrentTime(mediaElement.currentTime);
        setDuration(mediaElement.duration || 0);
        setVolume(mediaElement.volume);
        setIsMuted(mediaElement.muted);

        // Add event listeners
        const handleTimeUpdate = () => {
            setCurrentTime(mediaElement.currentTime);
            // Ensure canvas is updated when time changes
            if (canvas && type === 'video') {
                canvas.requestRenderAll();
            }
        };

        const handleDurationChange = () => {
            setDuration(mediaElement.duration);
        };

        const handleVolumeChange = () => {
            setVolume(mediaElement.volume);
            setIsMuted(mediaElement.muted);
        };

        const handlePlay = () => {
            setIsPlaying(true);
            // Start animation frame for video
            if (type === 'video' && canvas) {
                const updateVideoFrame = () => {
                    if (!mediaElement.paused && !mediaElement.ended) {
                        canvas.requestRenderAll();
                        animationRef.current = requestAnimationFrame(updateVideoFrame);
                    }
                };
                animationRef.current = requestAnimationFrame(updateVideoFrame);
            }
        };

        const handlePause = () => {
            setIsPlaying(false);
            // Cancel animation frame
            if (animationRef.current) {
                cancelAnimationFrame(animationRef.current);
                animationRef.current = null;
            }
        };

        const handleEnded = () => {
            setIsPlaying(false);
            // Cancel animation frame
            if (animationRef.current) {
                cancelAnimationFrame(animationRef.current);
                animationRef.current = null;
            }
        };

        mediaElement.addEventListener('timeupdate', handleTimeUpdate);
        mediaElement.addEventListener('durationchange', handleDurationChange);
        mediaElement.addEventListener('volumechange', handleVolumeChange);
        mediaElement.addEventListener('play', handlePlay);
        mediaElement.addEventListener('pause', handlePause);
        mediaElement.addEventListener('ended', handleEnded);

        // Cleanup function
        return () => {
            // Remove event listeners
            mediaElement.removeEventListener('timeupdate', handleTimeUpdate);
            mediaElement.removeEventListener('durationchange', handleDurationChange);
            mediaElement.removeEventListener('volumechange', handleVolumeChange);
            mediaElement.removeEventListener('play', handlePlay);
            mediaElement.removeEventListener('pause', handlePause);
            mediaElement.removeEventListener('ended', handleEnded);
            
            // Cancel any ongoing animation frames
            if (animationRef.current) {
                cancelAnimationFrame(animationRef.current);
                animationRef.current = null;
            }
        };
    }, [mediaObject, canvas, type]);

    const togglePlay = () => {
        if (!mediaObject || !mediaObject.mediaElement) return;
        
        const mediaElement = mediaObject.mediaElement;
        
        if (mediaElement.paused) {
            mediaElement.play()
                .then(() => {
                    setIsPlaying(true);
                })
                .catch(err => {
                    console.error("Error playing media:", err);
                });
        } else {
            mediaElement.pause();
            setIsPlaying(false);
            
            // Force a frame update when paused (especially important for video)
            if (type === 'video' && canvas) {
                canvas.requestRenderAll();
            }
        }
    };

    const toggleMute = () => {
        if (!mediaObject || !mediaObject.mediaElement) return;

        mediaObject.mediaElement.muted = !isMuted;
        setIsMuted(!isMuted);
    };

    const handleVolumeChange = (newVolume: number[]) => {
        if (!mediaObject || !mediaObject.mediaElement) return;

        mediaObject.mediaElement.volume = newVolume[0];
        if (newVolume[0] === 0) {
            mediaObject.mediaElement.muted = true;
        } else if (isMuted) {
            mediaObject.mediaElement.muted = false;
        }
    };

    // Handle seeking with the slider (which returns an array)
    const handleSliderSeek = (newTime: number[]) => {
        if (!mediaObject || !mediaObject.mediaElement || !newTime.length) return;
        handleSeek(newTime[0]);
    };

    // Direct seek to a specific time
    const handleSeek = (newTime: number) => {
        if (!mediaObject || !mediaObject.mediaElement) return;
        
        const mediaElement = mediaObject.mediaElement;
        mediaElement.currentTime = newTime;
        setCurrentTime(newTime);
        
        // Force canvas update after seeking for video
        if (type === 'video' && canvas) {
            // Request immediate render 
            canvas.requestRenderAll();
            
            // Request another render after a short delay to ensure frame is updated
            setTimeout(() => {
                canvas.requestRenderAll();
            }, 50);
        }
    };

    // Timeline preview click handler calls handleSeek directly
    const handleTimelineSeek = (newTime: number) => {
        handleSeek(newTime);
    };

    const handleFullscreen = () => {
        if (!mediaObject || !mediaObject.mediaElement || type !== 'video') return;

        if (!isFullscreen) {
            if (mediaObject.mediaElement.requestFullscreen) {
                mediaObject.mediaElement.requestFullscreen();
            }
        } else {
            if (document.exitFullscreen) {
                document.exitFullscreen();
            }
        }

        setIsFullscreen(!isFullscreen);
    };

    const formatTime = (seconds: number) => {
        const minutes = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${minutes}:${secs < 10 ? '0' : ''}${secs}`;
    };

    if (!mediaObject || !mediaObject.mediaElement) return null;

    return (
        <div
            ref={playerRef}
            className="w-full bg-gray-800/90 backdrop-blur-lg rounded-lg p-2 text-white"
        >
            {/* Timeline preview */}
            <TimelinePreview
                currentTime={currentTime}
                duration={duration}
                onSeek={handleTimelineSeek}
            />

            {/* Progress bar */}
            <div className="flex items-center gap-2 mb-2">
                <span className="text-xs">{formatTime(currentTime)}</span>
                <Slider
                    value={[currentTime]}
                    min={0}
                    max={duration}
                    step={0.01}
                    onValueChange={handleSliderSeek}
                    className="flex-1"
                />
                <span className="text-xs">{formatTime(duration)}</span>
            </div>

            {/* Control buttons */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-1">
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => {
                            if (mediaObject.mediaElement) {
                                mediaObject.mediaElement.currentTime = 0;
                            }
                        }}
                    >
                        <SkipBack className="h-4 w-4" />
                    </Button>

                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={togglePlay}
                    >
                        {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                    </Button>

                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => {
                            if (mediaObject.mediaElement) {
                                mediaObject.mediaElement.currentTime = duration;
                            }
                        }}
                    >
                        <SkipForward className="h-4 w-4" />
                    </Button>
                </div>

                <div className="flex items-center gap-2">
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={toggleMute}
                    >
                        {isMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
                    </Button>

                    <Slider
                        value={[isMuted ? 0 : volume]}
                        min={0}
                        max={1}
                        step={0.01}
                        onValueChange={handleVolumeChange}
                        className="w-20"
                    />

                    {type === 'video' && (
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={handleFullscreen}
                        >
                            {isFullscreen ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
                        </Button>
                    )}
                </div>
            </div>
        </div>
    );
};

export default MediaPlayer; 