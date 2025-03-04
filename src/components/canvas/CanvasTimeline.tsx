import React, { useState, useEffect, useRef } from 'react';
import { fabric } from 'fabric';
import { Play, Pause, SkipBack, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';

interface CanvasTimelineProps {
    canvas: fabric.Canvas | null;
    visible: boolean;
    onToggle: () => void;
}

const CanvasTimeline: React.FC<CanvasTimelineProps> = ({ canvas, visible, onToggle }) => {
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [mediaElements, setMediaElements] = useState<Array<fabric.Object & {
        mediaElement?: HTMLVideoElement | HTMLAudioElement
    }>>([]);

    // Find all media elements on the canvas
    useEffect(() => {
        if (!canvas) return;

        const updateMediaElements = () => {
            const objects = canvas.getObjects();
            const mediaObjs = objects.filter(obj => {
                return obj.data?.type === 'video' || obj.data?.type === 'audio';
            }) as Array<fabric.Object & { mediaElement?: HTMLVideoElement | HTMLAudioElement }>;

            setMediaElements(mediaObjs);

            // Calculate maximum duration
            let maxDuration = 0;
            for (const obj of mediaObjs) {
                if (obj.mediaElement?.duration) {
                    maxDuration = Math.max(maxDuration, obj.mediaElement.duration);
                }
            }
            setDuration(maxDuration);
        };

        updateMediaElements();

        const handleObjectAdded = () => {
            updateMediaElements();
        };

        const handleObjectRemoved = () => {
            updateMediaElements();
        };

        canvas.on('object:added', handleObjectAdded);
        canvas.on('object:removed', handleObjectRemoved);

        return () => {
            canvas.off('object:added', handleObjectAdded);
            canvas.off('object:removed', handleObjectRemoved);
        };
    }, [canvas]);

    // Update current time
    useEffect(() => {
        if (mediaElements.length === 0 || !isPlaying) return;

        let animationFrame: number;

        const updateTime = () => {
            // Get maximum current time
            let maxCurrentTime = 0;
            for (const obj of mediaElements) {
                if (obj.mediaElement?.currentTime) {
                    maxCurrentTime = Math.max(maxCurrentTime, obj.mediaElement.currentTime);
                }
            }

            setCurrentTime(maxCurrentTime);

            if (maxCurrentTime >= duration) {
                setIsPlaying(false);
            } else if (isPlaying) {
                animationFrame = requestAnimationFrame(updateTime);
            }
        };

        animationFrame = requestAnimationFrame(updateTime);

        return () => {
            cancelAnimationFrame(animationFrame);
        };
    }, [mediaElements, isPlaying, duration]);

    const togglePlayback = () => {
        if (mediaElements.length === 0) return;

        const newPlayState = !isPlaying;
        setIsPlaying(newPlayState);

        // Play or pause all media elements
        for (const obj of mediaElements) {
            if (obj.mediaElement) {
                if (newPlayState) {
                    obj.mediaElement.play();
                } else {
                    obj.mediaElement.pause();
                }
            }
        }
    };

    const handleSeek = (newTime: number[]) => {
        if (mediaElements.length === 0) return;

        const seekTime = newTime[0];
        setCurrentTime(seekTime);

        // Update all media elements
        for (const obj of mediaElements) {
            if (obj.mediaElement) {
                obj.mediaElement.currentTime = seekTime;
            }
        }
    };

    const resetPlayback = () => {
        if (mediaElements.length === 0) return;

        setCurrentTime(0);
        setIsPlaying(false);

        // Reset all media elements
        for (const obj of mediaElements) {
            if (obj.mediaElement) {
                obj.mediaElement.pause();
                obj.mediaElement.currentTime = 0;
            }
        }
    };

    const formatTime = (seconds: number) => {
        const minutes = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${minutes}:${secs < 10 ? '0' : ''}${secs}`;
    };

    if (!visible) {
        return (
            <Button
                variant="ghost"
                size="icon"
                className="fixed bottom-4 right-4 h-10 w-10 rounded-full bg-gray-800/90 backdrop-blur-lg shadow-lg z-50"
                onClick={onToggle}
            >
                <Clock className="h-5 w-5" />
            </Button>
        );
    }

    return (
        <div className="fixed bottom-0 left-0 right-0 bg-gray-800/90 backdrop-blur-lg border-t border-purple-500/20 p-4 z-50">
            <div className="max-w-5xl mx-auto">
                <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={togglePlayback}
                            disabled={mediaElements.length === 0}
                            className="h-10 w-10"
                        >
                            {isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
                        </Button>

                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={resetPlayback}
                            disabled={mediaElements.length === 0}
                            className="h-10 w-10"
                        >
                            <SkipBack className="h-5 w-5" />
                        </Button>

                        <span className="text-sm font-mono">
                            {formatTime(currentTime)} / {formatTime(duration)}
                        </span>
                    </div>

                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={onToggle}
                    >
                        Hide Timeline
                    </Button>
                </div>

                <Slider
                    value={[currentTime]}
                    min={0}
                    max={duration || 100}
                    step={0.1}
                    onValueChange={handleSeek}
                    disabled={mediaElements.length === 0}
                    className="w-full"
                />

                <div className="mt-2 flex flex-wrap gap-2">
                    {mediaElements.map((mediaObj, index) => (
                        <div
                            key={index}
                            className="flex items-center gap-2 bg-gray-700/50 rounded p-1 text-xs"
                        >
                            <div
                                className="w-3 h-3 rounded-full"
                                style={{
                                    backgroundColor: mediaObj.data?.type === 'video' ? '#8b5cf6' : '#ec4899'
                                }}
                            />
                            <span>
                                {mediaObj.data?.name || `${mediaObj.data?.type || 'Media'} ${index + 1}`}
                            </span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default CanvasTimeline; 