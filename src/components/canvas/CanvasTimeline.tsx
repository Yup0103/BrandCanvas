import React, { useState, useEffect, useRef, useCallback } from 'react';
import { fabric } from 'fabric';
import { 
  Play, 
  Pause, 
  SkipBack, 
  Clock, 
  MoreHorizontal, 
  Eye, 
  EyeOff, 
  Lock, 
  Unlock,
  ZoomIn,
  ZoomOut,
  MoveHorizontal,
  ArrowLeft,
  ArrowRight
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
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
    id?: string;
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
    const [viewportWidth, setViewportWidth] = useState(0);
    const [viewportHeight, setViewportHeight] = useState(0);
    const [scrollLeft, setScrollLeft] = useState(0);
    const [isAutoScroll, setIsAutoScroll] = useState(true);
    
    const timelineRef = useRef<HTMLDivElement>(null);
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const tracksContainerRef = useRef<HTMLDivElement>(null);
    const animationRef = useRef<number | null>(null);
    const lastUpdateTime = useRef<number>(Date.now());
    // Use refs to avoid infinite render loops
    const scrollPositionRef = useRef(0);

    // Add reference to scroll container
    const scrollAreaRef = useRef<HTMLDivElement>(null);
    
    // Add state for tracking if user is holding shift key
    const [isShiftKeyPressed, setIsShiftKeyPressed] = useState(false);
    
    // Track shift key press/release
    useEffect(() => {
        if (!visible) return;
        
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Shift') {
                setIsShiftKeyPressed(true);
            }
        };
        
        const handleKeyUp = (e: KeyboardEvent) => {
            if (e.key === 'Shift') {
                setIsShiftKeyPressed(false);
            }
        };
        
        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('keyup', handleKeyUp);
        
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('keyup', handleKeyUp);
        };
    }, [visible]);
    
    // Handle wheel events for intuitive scrolling
    const handleWheel = useCallback((e: WheelEvent) => {
        e.preventDefault(); // Prevent default scrolling
        
        if (!scrollAreaRef.current) return;
        
        const scrollContent = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]') as HTMLElement;
        if (!scrollContent) return;
        
        const SCROLL_SPEED = 1.2; // Adjust speed multiplier as needed
        
        // Get the delta values
        const deltaX = e.deltaX;
        const deltaY = e.deltaY;
        
        // Determine scroll direction based on shift key or dominant axis
        const isHorizontalScroll = isShiftKeyPressed || Math.abs(deltaX) > Math.abs(deltaY);
        
        if (isHorizontalScroll) {
            // Horizontal scrolling (through time)
            const scrollAmount = (deltaX !== 0 ? deltaX : deltaY) * SCROLL_SPEED;
            scrollContent.scrollLeft += scrollAmount;
            
            // Update scroll position for playhead sync
            scrollPositionRef.current = scrollContent.scrollLeft;
            setScrollLeft(scrollContent.scrollLeft);
        } else {
            // Vertical scrolling (through tracks)
            scrollContent.scrollTop += deltaY * SCROLL_SPEED;
        }
    }, [isShiftKeyPressed]);
    
    // Apply wheel event listener
    useEffect(() => {
        if (!visible || !scrollAreaRef.current) return;
        
        const scrollArea = scrollAreaRef.current;
        
        // Add passive: false to override default scroll behavior
        scrollArea.addEventListener('wheel', handleWheel as EventListener, { passive: false });
        
        return () => {
            scrollArea.removeEventListener('wheel', handleWheel as EventListener);
        };
    }, [visible, handleWheel]);

    // Update viewport dimensions
    useEffect(() => {
        if (!visible) return;
        
        const updateViewportSize = () => {
            if (scrollContainerRef.current) {
                setViewportWidth(scrollContainerRef.current.clientWidth);
                setViewportHeight(scrollContainerRef.current.clientHeight);
            }
        };
        
        // Initial size update
        updateViewportSize();
        
        // Add resize listener
        window.addEventListener('resize', updateViewportSize);
        
        return () => {
            window.removeEventListener('resize', updateViewportSize);
        };
    }, [visible]);

    // Find all video objects on the canvas and update video tracks
    useEffect(() => {
        if (!canvas || !visible) return;

        const updateVideoObjects = () => {
        if (!canvas) return;

            const objects = canvas.getObjects();
            const videoObjects = objects.filter(obj => {
                const videoObj = obj as VideoObject;
                return videoObj.mediaElement && videoObj.mediaElement instanceof HTMLVideoElement;
            }) as VideoObject[];
            
            // Update existing tracks and add new ones
            setVideoTracks(prevTracks => {
                const newTracks: VideoTrack[] = [];
                let maxDuration = 0;
                
                videoObjects.forEach(videoObj => {
                    if (!videoObj.mediaElement) return;
                    
                    const videoElement = videoObj.mediaElement;
                    // Use object ID instead of object reference for more reliable tracking
                    const existingTrack = prevTracks.find(t => 
                        // Check if objects have same ID or if they are the same reference
                        (videoObj.id && t.mediaObject.id === videoObj.id) || t.mediaObject === videoObj
                    );
                    const videoDuration = isNaN(videoElement.duration) ? 0 : videoElement.duration;
                    
                    if (existingTrack) {
                        // Update existing track
                        newTracks.push({
                            ...existingTrack,
                            duration: videoDuration,
                            mediaObject: videoObj // Update with latest reference
                        });
                    } else {
                        // Create a new track
                        const trackName = videoObj.data?.name || 'Unnamed Video';
                        newTracks.push({
                            id: `track-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
                            mediaObject: videoObj,
                            name: trackName,
                            duration: videoDuration,
                            isVisible: true,
                            isLocked: false,
                            thumbnails: []
                        });
                    }
                    
                    maxDuration = Math.max(maxDuration, videoDuration);
                });
                
                // Update duration based on max video length
                if (maxDuration > 0) {
                    setDuration(maxDuration);
                }
                
                // Keep only tracks that have corresponding objects on canvas
                return newTracks;
            });
        };
        
        // Generate thumbnails for tracks that don't have them
        const generateThumbnails = async () => {
            setVideoTracks(prevTracks => {
                return prevTracks.map(track => {
                    if (track.thumbnails.length === 0 && track.duration > 0) {
                        // Schedule thumbnail generation
                        setTimeout(() => {
                            generateVideoThumbnails(track);
                        }, 500);
                    }
                    return track;
                });
            });
        };
        
        // Initial update
        updateVideoObjects();
        generateThumbnails();
        
        // Listen for new videos added to canvas
        const handleObjectAdded = (e: any) => {
            const addedObject = e.target as VideoObject;
            if (addedObject.mediaElement instanceof HTMLVideoElement) {
                console.log('Video added to canvas:', addedObject);
                updateVideoObjects();
                // Delay thumbnail generation slightly to ensure video is ready
                setTimeout(() => {
                    generateThumbnails();
                }, 800);
            }
        };
        
        const handleObjectRemoved = (e: any) => {
            const removedObject = e.target as VideoObject;
            if (removedObject.mediaElement instanceof HTMLVideoElement) {
                setVideoTracks(prevTracks => 
                    prevTracks.filter(track => track.mediaObject !== removedObject)
                );
            }
        };

        canvas.on('object:added', handleObjectAdded);
        canvas.on('object:removed', handleObjectRemoved);

        return () => {
            canvas.off('object:added', handleObjectAdded);
            canvas.off('object:removed', handleObjectRemoved);
        };
    }, [canvas, visible]);

    // Generate thumbnails for a video track
    const generateVideoThumbnails = async (track: VideoTrack) => {
        if (!track.mediaObject.mediaElement) return;
        
        // Local variable to prevent multiple simultaneous thumbnail generation
        const localGenerating = isGeneratingThumbnails;
        if (localGenerating) {
            // If already generating thumbnails, schedule this for later
            setTimeout(() => generateVideoThumbnails(track), 1000);
            return;
        }
        
        setIsGeneratingThumbnails(true);
        
        try {
            const video = track.mediaObject.mediaElement;
            const numThumbnails = Math.max(5, Math.ceil(track.duration / 2)); // One thumbnail every ~2 seconds
            const thumbnails: string[] = [];
            
            // Create an offscreen canvas for thumbnail generation
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            if (!ctx) {
                throw new Error('Could not get canvas context');
            }
            
            canvas.width = 160;
            canvas.height = 90;
            
            // Store original current time to restore later
            const originalTime = video.currentTime;
            
            // Generate thumbnails at even intervals
            for (let i = 0; i < numThumbnails; i++) {
                const timePoint = (i / (numThumbnails - 1)) * track.duration;
                
                // Seek to time point
                video.currentTime = timePoint;
                
                // Wait for video to seek
                await new Promise<void>((resolve, reject) => {
                    const onSeeked = () => {
                        video.removeEventListener('seeked', onSeeked);
                        video.removeEventListener('error', onError);
                        resolve();
                    };
                    
                    const onError = (e: Event) => {
                        video.removeEventListener('seeked', onSeeked);
                        video.removeEventListener('error', onError);
                        reject(new Error('Video seek error'));
                    };
                    
                    const timeoutId = setTimeout(() => {
                        video.removeEventListener('seeked', onSeeked);
                        video.removeEventListener('error', onError);
                        // Just continue if we time out on a frame
                        resolve();
                    }, 500); // 500ms timeout
                    
                    video.addEventListener('seeked', onSeeked);
                    video.addEventListener('error', onError);
                });
                
                // Draw video frame to canvas
                ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                
                // Convert to data URL
                const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
                thumbnails.push(dataUrl);
            }
            
            // Update track with thumbnails
            setVideoTracks(prevTracks => 
                prevTracks.map(t => 
                    t.id === track.id ? { ...t, thumbnails } : t
                )
            );
            
            // Reset video state
            video.currentTime = originalTime;
        } catch (error) {
            console.error('Error generating thumbnails:', error);
        } finally {
            setIsGeneratingThumbnails(false);
        }
    };

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

            // Auto-scroll timeline if enabled
            if (isAutoScroll && scrollContainerRef.current) {
                const timePosition = maxCurrentTime * scale;
                // Only scroll if playhead is getting close to the edge of the viewport
                const bufferZone = viewportWidth * 0.2; // 20% of viewport width
                
                const currentScrollLeft = scrollPositionRef.current;
                
                if (timePosition > currentScrollLeft + viewportWidth - bufferZone || 
                    timePosition < currentScrollLeft + bufferZone) {
                    // Center the playhead
                    const newScrollLeft = timePosition - (viewportWidth / 2);
                    scrollContainerRef.current.scrollLeft = newScrollLeft;
                    scrollPositionRef.current = newScrollLeft;
                }
            }

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
    }, [videoTracks, isPlaying, duration, scale, viewportWidth, isAutoScroll]);

    // Track scroll position
    useEffect(() => {
        if (!scrollContainerRef.current || !visible) return;
        
        const handleScroll = () => {
            if (scrollContainerRef.current) {
                const newScrollLeft = scrollContainerRef.current.scrollLeft;
                scrollPositionRef.current = newScrollLeft;
                // Only update state when needed to avoid render loops
                if (Math.abs(scrollLeft - newScrollLeft) > 5) {
                    setScrollLeft(newScrollLeft);
                }
            }
        };
        
        scrollContainerRef.current.addEventListener('scroll', handleScroll);
        return () => {
            scrollContainerRef.current?.removeEventListener('scroll', handleScroll);
        };
    }, [visible, scrollLeft]);

    // Toggle playback
    const togglePlayback = () => {
        const newIsPlaying = !isPlaying;
        setIsPlaying(newIsPlaying);
        
        videoTracks.forEach(track => {
            if (track.mediaObject.mediaElement) {
                if (newIsPlaying) {
                    track.mediaObject.mediaElement.play();
                } else {
                    track.mediaObject.mediaElement.pause();
                }
            }
        });
    };

    // Reset to beginning
    const resetPlayback = () => {
        if (isPlaying) {
            setIsPlaying(false);
        }

        setCurrentTime(0);
        
        videoTracks.forEach(track => {
            if (track.mediaObject.mediaElement) {
                track.mediaObject.mediaElement.pause();
                track.mediaObject.mediaElement.currentTime = 0;
            }
        });
    };

    // Seek to specific time
    const seekToTime = (time: number) => {
        // Clamp the time to valid range
        const clampedTime = Math.max(0, Math.min(time, duration));
        
        setCurrentTime(clampedTime);
        
        videoTracks.forEach(track => {
            if (track.mediaObject.mediaElement) {
                track.mediaObject.mediaElement.currentTime = clampedTime;
            }
        });
    };

    // Handle timeline click
    const handleTimelineClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
        if (!timelineRef.current) return;
        
        const rect = timelineRef.current.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const currentScrollLeft = scrollPositionRef.current;
        
        // Convert position to time, considering scroll offset
        const time = (x + currentScrollLeft) / scale;
        
        seekToTime(time);
    }, [scale, duration]);

    // Zoom in/out functions
    const zoomIn = useCallback(() => {
        setScale(prevScale => Math.min(prevScale * 1.5, 200)); // Max 200px per second
    }, []);
    
    const zoomOut = useCallback(() => {
        setScale(prevScale => Math.max(prevScale / 1.5, 5)); // Min 5px per second
    }, []);
    
    // Zoom to fit all content
    const zoomToFit = useCallback(() => {
        if (!scrollContainerRef.current || duration <= 0) return;
        
        const availableWidth = scrollContainerRef.current.clientWidth - 40; // 40px for padding
        const newScale = Math.max(5, availableWidth / duration);
        setScale(newScale);
        
        // Reset scroll position
        if (scrollContainerRef.current) {
            scrollContainerRef.current.scrollLeft = 0;
            scrollPositionRef.current = 0;
            setScrollLeft(0);
        }
    }, [duration]);
    
    // Navigate left/right
    const navigateLeft = useCallback(() => {
        if (!scrollContainerRef.current) return;
        const currentScrollLeft = scrollPositionRef.current;
        const newScrollLeft = Math.max(0, currentScrollLeft - viewportWidth / 2);
        scrollContainerRef.current.scrollLeft = newScrollLeft;
        scrollPositionRef.current = newScrollLeft;
        setScrollLeft(newScrollLeft);
    }, [viewportWidth]);
    
    const navigateRight = useCallback(() => {
        if (!scrollContainerRef.current) return;
        const currentScrollLeft = scrollPositionRef.current;
        const maxScroll = Math.max(0, duration * scale - viewportWidth);
        const newScrollLeft = Math.min(maxScroll, currentScrollLeft + viewportWidth / 2);
        scrollContainerRef.current.scrollLeft = newScrollLeft;
        scrollPositionRef.current = newScrollLeft;
        setScrollLeft(newScrollLeft);
    }, [viewportWidth, duration, scale]);

    // Toggle track visibility
    const toggleTrackVisibility = useCallback((trackId: string) => {
        setVideoTracks(prevTracks => 
            prevTracks.map(track => {
                if (track.id === trackId) {
                    // Toggle visibility
                    const newIsVisible = !track.isVisible;
                    
                    // Update fabric object opacity
                    if (track.mediaObject) {
                        track.mediaObject.set('opacity', newIsVisible ? 1 : 0);
                        canvas?.renderAll();
                    }
                    
                    return { ...track, isVisible: newIsVisible };
                }
                return track;
            })
        );
    }, [canvas]);

    // Toggle track lock
    const toggleTrackLock = useCallback((trackId: string) => {
        setVideoTracks(prevTracks => 
            prevTracks.map(track => {
                if (track.id === trackId) {
                    // Toggle lock
                    const newIsLocked = !track.isLocked;
                    
                    // Update fabric object selectable/editable status
                    if (track.mediaObject) {
                        track.mediaObject.set({
                            selectable: !newIsLocked,
                            evented: !newIsLocked,
                            lockMovementX: newIsLocked,
                            lockMovementY: newIsLocked,
                            lockRotation: newIsLocked,
                            lockScalingX: newIsLocked,
                            lockScalingY: newIsLocked
                        });
                        canvas?.renderAll();
                    }
                    
                    return { ...track, isLocked: newIsLocked };
                }
                return track;
            })
        );
    }, [canvas]);

    // Format time as MM:SS
    const formatTime = useCallback((seconds: number): string => {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }, []);

    if (!visible) return null;

    const timelineWidth = Math.max(duration * scale, viewportWidth);

    return (
        <div className="absolute bottom-0 left-0 right-0 bg-gray-900/95 border-t border-purple-500/20 h-56 z-30 flex flex-col">
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
                
                {/* Zoom controls */}
                <div className="flex items-center gap-2">
                    <TooltipProvider>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={zoomIn}
                                    disabled={scale >= 200}
                                >
                                    <ZoomIn className="h-4 w-4" />
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                                <p>Zoom In</p>
                            </TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                    
                    <TooltipProvider>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={zoomOut}
                                    disabled={scale <= 5}
                                >
                                    <ZoomOut className="h-4 w-4" />
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                                <p>Zoom Out</p>
                            </TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                    
                    <TooltipProvider>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={zoomToFit}
                                >
                                    <MoveHorizontal className="h-4 w-4" />
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                                <p>Fit Timeline</p>
                            </TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                    
                    <TooltipProvider>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button
                                    variant={isAutoScroll ? "default" : "ghost"}
                                    size="sm"
                                    onClick={() => setIsAutoScroll(!isAutoScroll)}
                                    className="text-xs"
                                >
                                    Auto-Scroll
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                                <p>{isAutoScroll ? 'Disable' : 'Enable'} auto-scrolling during playback</p>
                            </TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                </div>
            </div>
            
            <ScrollArea 
                className="flex-1 relative" 
                style={{ width: '100%', height: '100%' }}
                ref={scrollAreaRef}
            >
                <div className="min-w-full h-full flex flex-col">
                    {/* Timeline ruler */}
                    <div className="h-6 border-b border-purple-500/20 relative">
                        <div className="absolute inset-y-0 left-20 right-0">
                            <div 
                                className="h-full flex items-end relative"
                                style={{ width: `${timelineWidth}px` }}
                            >
                                {Array.from({ length: Math.ceil(duration) + 1 }).map((_, i) => (
                                    <div 
                                        key={i} 
                                        className="absolute h-full flex flex-col justify-end items-center" 
                                        style={{ left: `${i * scale}px` }}
                                    >
                                        <div className="w-px h-3 bg-purple-500/40"></div>
                                        <span className="text-xs text-gray-400">{formatTime(i)}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                    
                    {/* Video tracks area */}
                    <div 
                        className="flex-1 relative"
                        style={{ width: `${timelineWidth}px`, minHeight: "100%" }}
                    >
                        {/* Track content area */}
                        <div className="relative">
                            {videoTracks.map(track => (
                                <div key={track.id} className="flex h-20 border-b border-purple-500/20">
                                    {/* Track info fixed sidebar */}
                                    <div className="w-20 flex-shrink-0 p-2 bg-gray-800 flex flex-col justify-between sticky left-0 z-10">
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
                                    <div className="flex-1 relative h-full">
                                        {/* Thumbnails */}
                                        <div className="absolute inset-0 flex items-center p-1">
                                            {track.thumbnails.map((thumbnail, i) => {
                                                const position = (i / (track.thumbnails.length - 1 || 1)) * track.duration * scale;
                                                const thumbWidth = Math.max(30, scale * 0.5); // Dynamic thumbnail width based on scale
                                                return (
                                                    <div 
                                                        key={i}
                                                        className="absolute top-1 bottom-1 overflow-hidden rounded-sm border border-purple-500/30"
                                                        style={{ 
                                                            left: `${position - (thumbWidth/2)}px`,
                                                            width: `${thumbWidth}px` 
                                                        }}
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
                    </div>
                    
                    {/* Playhead/timeline interaction area */}
                    <div 
                        ref={timelineRef}
                        className="absolute top-6 bottom-0 left-20 right-0 cursor-pointer"
                        onClick={handleTimelineClick}
                    >
                        {/* Current time indicator */}
                        <div
                            className="absolute top-0 bottom-0 w-px bg-red-500 z-10 pointer-events-none"
                            style={{ left: `${currentTime * scale}px` }}
                        >
                            <div className="w-3 h-3 bg-red-500 -ml-1.5 rounded-full"></div>
                        </div>
                    </div>
                </div>
                
                {/* Keep scrollbars for visual reference but with custom class */}
                <ScrollBar orientation="horizontal" className="h-2 opacity-70" />
                <ScrollBar orientation="vertical" className="w-2 opacity-70" />
            </ScrollArea>
            
            {/* Add instructions tooltip for scrolling */}
            <div className="absolute bottom-2 right-2 text-xs text-gray-500 opacity-60 pointer-events-none">
                <p>Scroll: ↕ Tracks | Shift+Scroll or two fingers: ↔ Timeline</p>
            </div>
        </div>
    );
};

export default CanvasTimeline; 