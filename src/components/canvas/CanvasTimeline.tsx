import React, { useState, useEffect, useRef, useCallback } from 'react';
import { fabric } from 'fabric';
import { Play, Pause, SkipBack, Clock, MoreHorizontal, Eye, EyeOff, Lock, Unlock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface VideoObject extends fabric.Object {
    mediaElement?: HTMLVideoElement;
    file?: File;
    data?: {
        type: string;
        name: string;
        originalWidth?: number;
        originalHeight?: number;
    };
}

interface CanvasTimelineProps {
    canvas: fabric.Canvas | null;
    visible: boolean;
    onToggle: () => void;
}

interface VideoTrack {
    id: string;
    mediaObject: VideoObject;
    name: string;
    duration: number;
    isVisible: boolean;
    isLocked: boolean;
    thumbnails: string[];
}

const CanvasTimeline: React.FC<CanvasTimelineProps> = ({ canvas, visible, onToggle }) => {
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [videoTracks, setVideoTracks] = useState<VideoTrack[]>([]);
    const [scale, setScale] = useState(20); // pixels per second
    const [isGeneratingThumbnails, setIsGeneratingThumbnails] = useState(false);
    
    const timelineRef = useRef<HTMLDivElement>(null);
    const animationRef = useRef<number | null>(null);
    const lastUpdateTime = useRef<number>(Date.now());

    // Find all video objects on the canvas
    useEffect(() => {
        if (!canvas) return;

        const updateVideoObjects = () => {
            const objects = canvas.getObjects();
            const videoObjs = objects.filter(obj => {
                return obj.data?.type === 'video';
            }) as VideoObject[];

            // Create or update tracks
            const newTracks = videoObjs.map(obj => {
                const existingTrack = videoTracks.find(
                    track => track.mediaObject === obj
                );

                if (existingTrack) {
                    return {
                        ...existingTrack,
                        duration: obj.mediaElement?.duration || 0,
                    };
                }

                // Create new track
                return {
                    id: Math.random().toString(36).substring(2, 9),
                    mediaObject: obj,
                    name: obj.data?.name || 'Unnamed Video',
                    duration: obj.mediaElement?.duration || 0,
                    isVisible: true,
                    isLocked: false,
                    thumbnails: []
                };
            });

            // Calculate overall duration
            let maxDuration = 0;
            for (const track of newTracks) {
                maxDuration = Math.max(maxDuration, track.duration);
            }
            
            setVideoTracks(newTracks);
            setDuration(maxDuration);
            
            // Generate thumbnails for new tracks
            newTracks.filter(track => track.thumbnails.length === 0).forEach(track => {
                generateVideoThumbnails(track);
            });
        };

        updateVideoObjects();

        const handleObjectAdded = (e: any) => {
            const obj = e.target;
            if (obj?.data?.type === 'video') {
                updateVideoObjects();
            }
        };

        const handleObjectRemoved = (e: any) => {
            const obj = e.target;
            if (obj?.data?.type === 'video') {
                // Remove track
                setVideoTracks(prev => prev.filter(track => track.mediaObject !== obj));
                updateVideoObjects();
            }
        };

        canvas.on('object:added', handleObjectAdded);
        canvas.on('object:removed', handleObjectRemoved);

        return () => {
            canvas.off('object:added', handleObjectAdded);
            canvas.off('object:removed', handleObjectRemoved);
        };
    }, [canvas, videoTracks]);

    // Generate thumbnails for a video track
    const generateVideoThumbnails = useCallback(async (track: VideoTrack) => {
        if (!track.mediaObject.mediaElement || isGeneratingThumbnails) return;
        
        const video = track.mediaObject.mediaElement;
        const duration = video.duration;
        
        // Skip if video duration is not available or invalid
        if (!duration || isNaN(duration) || duration <= 0) return;
        
        setIsGeneratingThumbnails(true);
        
        // Create an offscreen canvas for thumbnail generation
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const thumbnailCount = Math.max(5, Math.floor(duration));
        const thumbnails: string[] = [];
        
        // Set thumbnail size
        canvas.width = 80;
        canvas.height = 45;
        
        if (!ctx) {
            setIsGeneratingThumbnails(false);
            return;
        }
        
        // Save current video time
        const currentTime = video.currentTime;
        
        try {
            // Generate thumbnails at even intervals
            for (let i = 0; i < thumbnailCount; i++) {
                const timePoint = (i / (thumbnailCount - 1)) * duration;
                
                // Seek to the time point
                video.currentTime = timePoint;
                
                // Wait for the frame to be available
                await new Promise<void>(resolve => {
                    const onSeeked = () => {
                        video.removeEventListener('seeked', onSeeked);
                        resolve();
                    };
                    
                    video.addEventListener('seeked', onSeeked);
                });
                
                // Draw the frame to canvas
                ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                
                // Convert to data URL
                const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
                thumbnails.push(dataUrl);
            }
            
            // Restore video time
            video.currentTime = currentTime;
            
            // Update track thumbnails
            setVideoTracks(prev => 
                prev.map(t => t.id === track.id ? { ...t, thumbnails } : t)
            );
        } catch (error) {
            console.error('Error generating thumbnails:', error);
        } finally {
            setIsGeneratingThumbnails(false);
        }
    }, [isGeneratingThumbnails]);

    // Update current time during playback
    useEffect(() => {
        if (videoTracks.length === 0 || !isPlaying) return;

        const updatePlayback = () => {
            const now = Date.now();
            const deltaTime = (now - lastUpdateTime.current) / 1000;
            lastUpdateTime.current = now;
            
            // Update current time
            let maxCurrentTime = 0;
            for (const track of videoTracks) {
                if (track.mediaObject.mediaElement?.currentTime) {
                    maxCurrentTime = Math.max(maxCurrentTime, track.mediaObject.mediaElement.currentTime);
                }
            }

            setCurrentTime(maxCurrentTime);

            if (maxCurrentTime >= duration) {
                setIsPlaying(false);
            } else if (isPlaying) {
                animationRef.current = requestAnimationFrame(updatePlayback);
            }
        };

        lastUpdateTime.current = Date.now();
        animationRef.current = requestAnimationFrame(updatePlayback);

        return () => {
            if (animationRef.current) {
                cancelAnimationFrame(animationRef.current);
            }
        };
    }, [videoTracks, isPlaying, duration]);

    // Toggle playback
    const togglePlayback = () => {
        if (videoTracks.length === 0) return;

        const newPlayState = !isPlaying;
        setIsPlaying(newPlayState);

        // Play or pause all videos
        for (const track of videoTracks) {
            if (!track.isVisible) continue;
            
            const video = track.mediaObject.mediaElement;
            if (!video) continue;

            if (newPlayState) {
                video.play();
            } else {
                video.pause();
            }
        }

        lastUpdateTime.current = Date.now();
    };

    // Reset to beginning
    const resetPlayback = () => {
        for (const track of videoTracks) {
            const video = track.mediaObject.mediaElement;
            if (video) {
                video.currentTime = 0;
            }
        }
        setCurrentTime(0);
        
        // Ensure canvas update
        if (canvas) {
            canvas.requestRenderAll();
        }
    };

    // Seek to specific time
    const seekToTime = (time: number) => {
        if (time < 0) time = 0;
        if (time > duration) time = duration;

        for (const track of videoTracks) {
            const video = track.mediaObject.mediaElement;
            if (video) {
                video.currentTime = time;
            }
        }
        setCurrentTime(time);

        // Ensure canvas update
        if (canvas) {
            setTimeout(() => canvas.requestRenderAll(), 50);
        }
    };

    // Handle timeline click
    const handleTimelineClick = (e: React.MouseEvent<HTMLDivElement>) => {
        if (!timelineRef.current) return;
        
        const rect = timelineRef.current.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const time = x / scale;
        
        seekToTime(time);
    };

    // Toggle track visibility
    const toggleTrackVisibility = (trackId: string) => {
        setVideoTracks(prev => 
            prev.map(track => {
                if (track.id === trackId) {
                    // Toggle visibility of the Fabric object
                    if (track.mediaObject) {
                        track.mediaObject.visible = !track.isVisible;
                        canvas?.requestRenderAll();
                    }
                    return { ...track, isVisible: !track.isVisible };
                }
                return track;
            })
        );
    };

    // Toggle track lock
    const toggleTrackLock = (trackId: string) => {
        setVideoTracks(prev => 
            prev.map(track => {
                if (track.id === trackId) {
                    // Toggle lock state of the Fabric object
                    if (track.mediaObject) {
                        const locked = !track.isLocked;
                        track.mediaObject.lockMovementX = locked;
                        track.mediaObject.lockMovementY = locked;
                        track.mediaObject.lockRotation = locked;
                        track.mediaObject.lockScalingX = locked;
                        track.mediaObject.lockScalingY = locked;
                        canvas?.requestRenderAll();
                    }
                    return { ...track, isLocked: !track.isLocked };
                }
                return track;
            })
        );
    };

    // Format time as MM:SS
    const formatTime = (seconds: number): string => {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    if (!visible) return null;

    return (
        <div className="absolute bottom-0 left-0 right-0 bg-gray-900/95 border-t border-purple-500/20 h-48 z-30 flex flex-col">
            <div className="flex items-center justify-between px-4 py-2 border-b border-purple-500/20">
                <div className="flex items-center gap-2">
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={togglePlayback}
                        disabled={videoTracks.length === 0}
                    >
                        {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                    </Button>
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={resetPlayback}
                        disabled={videoTracks.length === 0}
                    >
                        <SkipBack className="h-4 w-4" />
                    </Button>
                    <div className="text-sm font-mono">
                        {formatTime(currentTime)} / {formatTime(duration)}
                    </div>
                </div>
                
                <div>
                    <Button variant="ghost" size="sm" onClick={onToggle}>
                        <Clock className="h-4 w-4 mr-2" />
                        <span>Close Timeline</span>
                    </Button>
                </div>
            </div>
            
            <div className="flex-1 flex flex-col overflow-hidden">
                {/* Timeline ruler */}
                <div className="h-6 border-b border-purple-500/20 relative flex items-end px-20">
                    {Array.from({ length: Math.ceil(duration) + 1 }).map((_, i) => (
                        <div key={i} className="absolute h-full flex flex-col justify-end items-center" style={{ left: `${i * scale}px` }}>
                            <div className="w-px h-3 bg-purple-500/40"></div>
                            <span className="text-xs text-gray-400">{formatTime(i)}</span>
                        </div>
                    ))}
                </div>
                
                {/* Video tracks container */}
                <ScrollArea className="flex-1">
                    <div className="min-w-full">
                        {videoTracks.map(track => (
                            <div key={track.id} className="flex h-20 border-b border-purple-500/20">
                                {/* Track info */}
                                <div className="w-20 flex-shrink-0 p-2 bg-gray-800 flex flex-col justify-between">
                                    <div className="truncate text-xs" title={track.name}>
                                        {track.name}
                                    </div>
                                    <div className="flex gap-1">
                                        <TooltipProvider>
                                            <Tooltip>
                                                <TooltipTrigger asChild>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-6 w-6"
                                                        onClick={() => toggleTrackVisibility(track.id)}
                                                    >
                                                        {track.isVisible ? (
                                                            <Eye className="h-3 w-3" />
                                                        ) : (
                                                            <EyeOff className="h-3 w-3" />
                                                        )}
                                                    </Button>
                                                </TooltipTrigger>
                                                <TooltipContent>
                                                    <p>{track.isVisible ? 'Hide' : 'Show'} track</p>
                                                </TooltipContent>
                                            </Tooltip>
                                        </TooltipProvider>
                                        
                                        <TooltipProvider>
                                            <Tooltip>
                                                <TooltipTrigger asChild>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-6 w-6"
                                                        onClick={() => toggleTrackLock(track.id)}
                                                    >
                                                        {track.isLocked ? (
                                                            <Lock className="h-3 w-3" />
                                                        ) : (
                                                            <Unlock className="h-3 w-3" />
                                                        )}
                                                    </Button>
                                                </TooltipTrigger>
                                                <TooltipContent>
                                                    <p>{track.isLocked ? 'Unlock' : 'Lock'} track</p>
                                                </TooltipContent>
                                            </Tooltip>
                                        </TooltipProvider>
                                    </div>
                                </div>
                                
                                {/* Track timeline */}
                                <div 
                                    className="flex-1 relative h-full"
                                    style={{ width: `${track.duration * scale}px` }}
                                >
                                    {/* Thumbnails */}
                                    <div className="absolute inset-0 flex items-center p-1">
                                        {track.thumbnails.map((thumbnail, i) => {
                                            const position = (i / (track.thumbnails.length - 1 || 1)) * track.duration * scale;
                                            return (
                                                <div 
                                                    key={i}
                                                    className="absolute top-1 bottom-1 w-20 overflow-hidden rounded-sm border border-purple-500/30"
                                                    style={{ left: `${position - 40}px` }}
                                                >
                                                    <img 
                                                        src={thumbnail} 
                                                        alt={`Frame ${i}`}
                                                        className="w-full h-full object-cover"
                                                    />
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </ScrollArea>
                
                {/* Playhead/timeline interaction area */}
                <div 
                    ref={timelineRef}
                    className="absolute top-6 bottom-0 left-20 right-0 cursor-pointer"
                    onClick={handleTimelineClick}
                >
                    {/* Current time indicator */}
                    <div
                        className="absolute top-0 bottom-0 w-px bg-red-500 z-10"
                        style={{ left: `${currentTime * scale}px` }}
                    >
                        <div className="w-3 h-3 bg-red-500 -ml-1.5 rounded-full"></div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CanvasTimeline; 