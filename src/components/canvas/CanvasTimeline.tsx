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
  ArrowRight,
  Volume2,
  VolumeX
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

interface AudioObject extends fabric.Object {
    mediaElement?: HTMLAudioElement;
    file?: File;
    data?: {
        type: string;
        name: string;
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

interface AudioTrack {
    id: string;
    mediaObject: AudioObject;
    name: string;
    duration: number;
    isVisible: boolean;
    isLocked: boolean;
    isMuted: boolean;
    waveform: string[];
}

const CanvasTimeline: React.FC<CanvasTimelineProps> = ({ canvas, visible, onToggle }) => {
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [videoTracks, setVideoTracks] = useState<VideoTrack[]>([]);
    const [audioTracks, setAudioTracks] = useState<AudioTrack[]>([]);
    const [scale, setScale] = useState(20); // pixels per second
    const [isGeneratingThumbnails, setIsGeneratingThumbnails] = useState(false);
    const [isGeneratingWaveform, setIsGeneratingWaveform] = useState(false);
    const [viewportWidth, setViewportWidth] = useState(0);
    const [viewportHeight, setViewportHeight] = useState(0);
    const [scrollLeft, setScrollLeft] = useState(0);
    const [isAutoScroll, setIsAutoScroll] = useState(true);
    
    const timelineRef = useRef<HTMLDivElement>(null);
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
            if (scrollAreaRef.current) {
                setViewportWidth(scrollAreaRef.current.clientWidth);
                setViewportHeight(scrollAreaRef.current.clientHeight);
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

    // Find all media objects on the canvas and update tracks
    useEffect(() => {
        if (!canvas || !visible) return;

        const updateMediaObjects = () => {
        if (!canvas) return;

            const objects = canvas.getObjects();
            
            // Find video objects
            const videoObjects = objects.filter(obj => {
                const mediaObj = obj as VideoObject;
                return mediaObj.mediaElement && mediaObj.mediaElement instanceof HTMLVideoElement;
            }) as VideoObject[];
            
            // Find audio objects
            const audioObjects = objects.filter(obj => {
                const mediaObj = obj as any;
                return mediaObj.mediaElement && mediaObj.mediaElement instanceof HTMLAudioElement;
            }) as AudioObject[];
            
            // Update existing video tracks and add new ones
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
                            id: `video-track-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
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
                
                return newTracks;
            });
            
            // Update existing audio tracks and add new ones
            setAudioTracks(prevTracks => {
                const newTracks: AudioTrack[] = [];
            let maxDuration = 0;
                
                audioObjects.forEach(audioObj => {
                    if (!audioObj.mediaElement) return;
                    
                    const audioElement = audioObj.mediaElement;
                    // Use object ID instead of object reference for more reliable tracking
                    const existingTrack = prevTracks.find(t => 
                        // Check if objects have same ID or if they are the same reference
                        (audioObj.id && t.mediaObject.id === audioObj.id) || t.mediaObject === audioObj
                    );
                    const audioDuration = isNaN(audioElement.duration) ? 0 : audioElement.duration;
                    
                    if (existingTrack) {
                        // Update existing track
                        newTracks.push({
                            ...existingTrack,
                            duration: audioDuration,
                            mediaObject: audioObj // Update with latest reference
                        });
                    } else {
                        // Create a new track
                        const trackName = audioObj.data?.name || 'Unnamed Audio';
                        newTracks.push({
                            id: `audio-track-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
                            mediaObject: audioObj,
                            name: trackName,
                            duration: audioDuration,
                            isVisible: true,
                            isLocked: false,
                            isMuted: false,
                            waveform: []
                        });
                    }
                    
                    maxDuration = Math.max(maxDuration, audioDuration);
                });
                
                return newTracks;
            });
            
            // Update total duration based on the longest media
            const allTracks = [...videoTracks, ...audioTracks];
            if (allTracks.length > 0) {
                const maxDuration = Math.max(...allTracks.map(track => track.duration));
                if (maxDuration > 0) {
                    setDuration(maxDuration);
                }
            }
        };
        
        // Generate thumbnails and waveforms for tracks that don't have them
        const generateMediaVisualization = async () => {
            // Generate thumbnails for video tracks
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
            
            // Generate waveforms for audio tracks
            setAudioTracks(prevTracks => {
                return prevTracks.map(track => {
                    if (track.waveform.length === 0 && track.duration > 0) {
                        // Schedule waveform generation
                        setTimeout(() => {
                            generateAudioWaveform(track);
                        }, 500);
                    }
                    return track;
                });
            });
        };
        
        // Initial update
        updateMediaObjects();
        generateMediaVisualization();
        
        // Listen for objects added to canvas
        const handleObjectAdded = (e: any) => {
            const addedObject = e.target as any;
            if (addedObject.mediaElement instanceof HTMLVideoElement || 
                addedObject.mediaElement instanceof HTMLAudioElement) {
                console.log('Media added to canvas:', addedObject);
                updateMediaObjects();
                // Delay media visualization generation slightly to ensure media is ready
                setTimeout(() => {
                    generateMediaVisualization();
                }, 800);
            }
        };
        
        const handleObjectRemoved = (e: any) => {
            const removedObject = e.target as any;
            if (removedObject.mediaElement instanceof HTMLVideoElement) {
                setVideoTracks(prevTracks => 
                    prevTracks.filter(track => track.mediaObject !== removedObject)
                );
            } else if (removedObject.mediaElement instanceof HTMLAudioElement) {
                setAudioTracks(prevTracks => 
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
    }, [canvas, visible, videoTracks, audioTracks]);

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

    // Generate waveform for an audio track
    const generateAudioWaveform = async (track: AudioTrack) => {
        if (!track.mediaObject.mediaElement) return;
        
        // Prevent multiple simultaneous waveform generations
        if (isGeneratingWaveform) {
            setTimeout(() => generateAudioWaveform(track), 1000);
            return;
        }
        
        setIsGeneratingWaveform(true);
        
        try {
            const audio = track.mediaObject.mediaElement;
            const audioFile = track.mediaObject.file;
            
            if (!audioFile) {
                console.warn('No audio file found for waveform generation');
                createStylizedWaveform(track);
                return;
            }
            
            // Create an AudioContext for analyzing the audio
            const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
            
            // Load the audio file as an ArrayBuffer
            const arrayBuffer = await audioFile.arrayBuffer();
            
            // Decode the audio data
            const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
            
            // Get the raw audio data (we'll use the first channel for mono waveform)
            const channelData = audioBuffer.getChannelData(0);
            
            // For better looking waveforms, use more samples
            const numSamples = Math.max(150, Math.ceil(track.duration * 15)); // More samples for smoother look
            const samplesPerSegment = Math.floor(channelData.length / numSamples);
            
            const waveform: string[] = [];
            
            // Process audio data into beautiful waveform segments
            for (let i = 0; i < numSamples; i++) {
                const startSample = i * samplesPerSegment;
                const endSample = Math.min(startSample + samplesPerSegment, channelData.length);
                
                // For visual appeal, we'll still use actual audio data but simplify the calculation
                let sum = 0;
                for (let j = startSample; j < endSample; j++) {
                    sum += Math.abs(channelData[j]);
                }
                
                const amplitude = sum / (endSample - startSample);
                
                // Add visual smoothing with neighboring segments
                const smoothingFactor = 0.3;
                const normalizedPos = i / numSamples;
                const smoothedHeight = amplitude + (Math.sin(normalizedPos * Math.PI * 8) * smoothingFactor);
                
                // Scale to reasonable height (between 4 and 36 pixels)
                const minHeight = 4;
                const rawHeight = smoothedHeight * 60; // Amplify for visibility
                const height = minHeight + Math.min(36 - minHeight, rawHeight);
                
                // Create beautiful colors with gradients
                // Use a consistent purple palette with slight variations for visual interest
                const baseHue = 270; // Purple hue
                const hueVariation = Math.sin(normalizedPos * Math.PI * 3) * 10;
                const hue = baseHue + hueVariation;
                const saturation = 80;
                const lightness = 60;
                
                // Create a simple, elegant bar with rounded corners
                const svg = `<svg width="4" height="40" viewBox="0 0 4 40" xmlns="http://www.w3.org/2000/svg">
                    <rect 
                        x="0"
                        y="${(40-height)/2}"
                        width="4"
                        height="${height}"
                        rx="2"
                        fill="hsl(${hue}, ${saturation}%, ${lightness}%)"
                    />
                </svg>`;
                
                waveform.push(`data:image/svg+xml;base64,${btoa(svg)}`);
            }
            
            // Close the audio context when we're done
            await audioContext.close();
            
            // Update track with waveform
            setAudioTracks(prevTracks => 
                prevTracks.map(t => 
                    t.id === track.id ? { ...t, waveform } : t
                )
            );
            
        } catch (error) {
            console.error('Error generating waveform:', error);
            createStylizedWaveform(track);
        } finally {
            setIsGeneratingWaveform(false);
        }
    };
    
    // Generate an aesthetically pleasing waveform without audio analysis
    const createStylizedWaveform = (track: AudioTrack) => {
        const numSamples = Math.max(150, Math.ceil(track.duration * 15));
        const waveform: string[] = [];
        
        for (let i = 0; i < numSamples; i++) {
            const normalizedPos = i / numSamples;
            
            // Create a beautiful wave pattern using multiple sine waves
            const wave1 = Math.sin(normalizedPos * Math.PI * 8) * 0.5;
            const wave2 = Math.sin(normalizedPos * Math.PI * 16) * 0.25;
            const wave3 = Math.sin(normalizedPos * Math.PI * 32) * 0.125;
            
            // Combine waves for a natural, musical look
            const combinedWave = 0.5 + (wave1 + wave2 + wave3) * 0.4;
            
            // Scale to a visually pleasing height
            const height = 4 + (combinedWave * 32);
            
            // Create color variations
            const hue = 270 + (Math.sin(normalizedPos * Math.PI * 3) * 10);
            const saturation = 80;
            const lightness = 60;
            
            // Generate SVG
            const svg = `<svg width="4" height="40" viewBox="0 0 4 40" xmlns="http://www.w3.org/2000/svg">
                <rect 
                    x="0"
                    y="${(40-height)/2}"
                    width="4"
                    height="${height}"
                    rx="2"
                    fill="hsl(${hue}, ${saturation}%, ${lightness}%)"
                />
            </svg>`;
            
            waveform.push(`data:image/svg+xml;base64,${btoa(svg)}`);
        }
        
        // Update track with stylized waveform
        setAudioTracks(prevTracks => 
            prevTracks.map(t => 
                t.id === track.id ? { ...t, waveform } : t
            )
        );
    };

    // Update current time during playback
    useEffect(() => {
        // Changed this condition to allow playback updates with only audio tracks
        if ((!videoTracks.length && !audioTracks.length) || !isPlaying) return;

        const updatePlayback = () => {
            const now = Date.now();
            const deltaTime = (now - lastUpdateTime.current) / 1000;
            lastUpdateTime.current = now;

            // Update current time based on all media elements
            let maxCurrentTime = 0;
            let hasActiveMedia = false;
            
            // Check video tracks
            for (const track of videoTracks) {
                if (track.mediaObject.mediaElement?.currentTime) {
                    maxCurrentTime = Math.max(maxCurrentTime, track.mediaObject.mediaElement.currentTime);
                    hasActiveMedia = true;
                }
            }
            
            // Check audio tracks
            for (const track of audioTracks) {
                if (track.mediaObject.mediaElement?.currentTime) {
                    maxCurrentTime = Math.max(maxCurrentTime, track.mediaObject.mediaElement.currentTime);
                    hasActiveMedia = true;
                }
            }

            // Only update if we have active media
            if (hasActiveMedia) {
                setCurrentTime(maxCurrentTime);
            }

            // Auto-scroll timeline if enabled
            if (isAutoScroll && scrollAreaRef.current) {
                const timePosition = maxCurrentTime * scale;
                // Only scroll if playhead is getting close to the edge of the viewport
                const bufferZone = viewportWidth * 0.2; // 20% of viewport width
                
                const currentScrollLeft = scrollPositionRef.current;
                
                if (timePosition > currentScrollLeft + viewportWidth - bufferZone || 
                    timePosition < currentScrollLeft + bufferZone) {
                    // Center the playhead
                    const newScrollLeft = timePosition - (viewportWidth / 2);
                    
                    // Access the viewport directly for scrolling
                    const scrollContent = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]') as HTMLElement;
                    if (scrollContent) {
                        scrollContent.scrollLeft = newScrollLeft;
                        scrollPositionRef.current = newScrollLeft;
                        setScrollLeft(newScrollLeft);
                    }
                }
            }

            // Check if any media has reached the end
            if (maxCurrentTime >= duration) {
                setIsPlaying(false);
                
                // Pause all media
                videoTracks.forEach(track => {
                    if (track.mediaObject.mediaElement) {
                        track.mediaObject.mediaElement.pause();
                    }
                });
                
                audioTracks.forEach(track => {
                    if (track.mediaObject.mediaElement) {
                        track.mediaObject.mediaElement.pause();
                    }
                });
            } else if (isPlaying) {
                // Continue animation loop
                animationRef.current = requestAnimationFrame(updatePlayback);
            }
        };

        // Initialize the animation loop
        lastUpdateTime.current = Date.now();
        animationRef.current = requestAnimationFrame(updatePlayback);

        return () => {
            if (animationRef.current) {
                cancelAnimationFrame(animationRef.current);
                animationRef.current = null;
            }
        };
    }, [videoTracks, audioTracks, isPlaying, duration, scale, viewportWidth, isAutoScroll]);

    // Track scroll position
    useEffect(() => {
        if (!scrollAreaRef.current || !visible) return;
        
        const handleScroll = () => {
            const scrollContent = scrollAreaRef.current?.querySelector('[data-radix-scroll-area-viewport]') as HTMLElement;
            if (scrollContent) {
                const newScrollLeft = scrollContent.scrollLeft;
                scrollPositionRef.current = newScrollLeft;
                // Only update state when needed to avoid render loops
                if (Math.abs(scrollLeft - newScrollLeft) > 5) {
                    setScrollLeft(newScrollLeft);
                }
            }
        };
        
        const scrollContent = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]') as HTMLElement;
        if (scrollContent) {
            scrollContent.addEventListener('scroll', handleScroll);
            return () => {
                scrollContent.removeEventListener('scroll', handleScroll);
            };
        }
    }, [visible, scrollLeft]);

    // Toggle playback
    const togglePlayback = () => {
        const newIsPlaying = !isPlaying;
        setIsPlaying(newIsPlaying);
        
        // Handle video playback
        videoTracks.forEach(track => {
            if (track.mediaObject.mediaElement) {
                if (newIsPlaying) {
                    track.mediaObject.mediaElement.play();
                } else {
                    track.mediaObject.mediaElement.pause();
                }
            }
        });
        
        // Handle audio playback
        audioTracks.forEach(track => {
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
        
        // Reset videos
        videoTracks.forEach(track => {
            if (track.mediaObject.mediaElement) {
                track.mediaObject.mediaElement.pause();
                track.mediaObject.mediaElement.currentTime = 0;
            }
        });
        
        // Reset audio
        audioTracks.forEach(track => {
            if (track.mediaObject.mediaElement) {
                track.mediaObject.mediaElement.pause();
                track.mediaObject.mediaElement.currentTime = 0;
            }
        });
    };

    // Seek to time
    const seekToTime = (time: number) => {
        setCurrentTime(time);
        
        // Seek videos
        videoTracks.forEach(track => {
            if (track.mediaObject.mediaElement) {
                track.mediaObject.mediaElement.currentTime = time;
            }
        });
        
        // Seek audio
        audioTracks.forEach(track => {
            if (track.mediaObject.mediaElement) {
                track.mediaObject.mediaElement.currentTime = time;
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
        if (!scrollAreaRef.current || duration <= 0) return;
        
        const availableWidth = scrollAreaRef.current.clientWidth - 40; // 40px for padding
        const newScale = Math.max(5, availableWidth / duration);
        setScale(newScale);
        
        // Reset scroll position
        if (scrollAreaRef.current) {
            scrollAreaRef.current.scrollLeft = 0;
            scrollPositionRef.current = 0;
            setScrollLeft(0);
        }
    }, [duration]);
    
    // Navigate left/right
    const navigateLeft = useCallback(() => {
        if (!scrollAreaRef.current) return;
        const currentScrollLeft = scrollPositionRef.current;
        const newScrollLeft = Math.max(0, currentScrollLeft - viewportWidth / 2);
        scrollAreaRef.current.scrollLeft = newScrollLeft;
        scrollPositionRef.current = newScrollLeft;
        setScrollLeft(newScrollLeft);
    }, [viewportWidth]);
    
    const navigateRight = useCallback(() => {
        if (!scrollAreaRef.current) return;
        const currentScrollLeft = scrollPositionRef.current;
        const maxScroll = Math.max(0, duration * scale - viewportWidth);
        const newScrollLeft = Math.min(maxScroll, currentScrollLeft + viewportWidth / 2);
        scrollAreaRef.current.scrollLeft = newScrollLeft;
        scrollPositionRef.current = newScrollLeft;
        setScrollLeft(newScrollLeft);
    }, [viewportWidth, duration, scale]);

    // Toggle audio track mute
    const toggleAudioMute = (trackId: string) => {
        setAudioTracks(prevTracks => {
            return prevTracks.map(track => {
                if (track.id === trackId) {
                    const newMuted = !track.isMuted;
                    
                    // Update the actual audio element
                    if (track.mediaObject.mediaElement) {
                        track.mediaObject.mediaElement.muted = newMuted;
                    }
                    
                    return { ...track, isMuted: newMuted };
                }
                return track;
            });
        });
    };

    // Toggle track visibility
    const toggleTrackVisibility = (trackId: string) => {
        // Check if it's a video track
        const videoTrack = videoTracks.find(t => t.id === trackId);
        if (videoTrack) {
            setVideoTracks(prevTracks => {
                return prevTracks.map(track => {
                    if (track.id === trackId) {
                        const newIsVisible = !track.isVisible;
                        if (track.mediaObject && canvas) {
                            track.mediaObject.visible = newIsVisible;
                            canvas.renderAll();
                        }
                        return { ...track, isVisible: newIsVisible };
                    }
                    return track;
                });
            });
            return;
        }
        
        // Check if it's an audio track
        const audioTrack = audioTracks.find(t => t.id === trackId);
        if (audioTrack) {
            setAudioTracks(prevTracks => {
                return prevTracks.map(track => {
                    if (track.id === trackId) {
                        const newIsVisible = !track.isVisible;
                        if (track.mediaObject && canvas) {
                            track.mediaObject.visible = newIsVisible;
                            canvas.renderAll();
                        }
                        return { ...track, isVisible: newIsVisible };
                    }
                    return track;
                });
            });
        }
    };

    // Toggle track lock
    const toggleTrackLock = (trackId: string) => {
        // Check if it's a video track
        const videoTrack = videoTracks.find(t => t.id === trackId);
        if (videoTrack) {
            setVideoTracks(prevTracks => {
                return prevTracks.map(track => {
                    if (track.id === trackId) {
                        const newIsLocked = !track.isLocked;
                        if (track.mediaObject && canvas) {
                            track.mediaObject.selectable = !newIsLocked;
                            track.mediaObject.evented = !newIsLocked;
                            canvas.renderAll();
                        }
                        return { ...track, isLocked: newIsLocked };
                    }
                    return track;
                });
            });
            return;
        }
        
        // Check if it's an audio track
        const audioTrack = audioTracks.find(t => t.id === trackId);
        if (audioTrack) {
            setAudioTracks(prevTracks => {
                return prevTracks.map(track => {
                    if (track.id === trackId) {
                        const newIsLocked = !track.isLocked;
                        if (track.mediaObject && canvas) {
                            track.mediaObject.selectable = !newIsLocked;
                            track.mediaObject.evented = !newIsLocked;
                            canvas.renderAll();
                        }
                        return { ...track, isLocked: newIsLocked };
                    }
                    return track;
                });
            });
        }
    };

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
                            disabled={videoTracks.length === 0 && audioTracks.length === 0}
                        >
                            {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                        </Button>
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={resetPlayback}
                            disabled={videoTracks.length === 0 && audioTracks.length === 0}
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
                    
                    {/* Media tracks area */}
                    <div 
                        className="flex-1 relative"
                        style={{ width: `${timelineWidth}px`, minHeight: "100%" }}
                    >
                        {/* Video tracks */}
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
                        
                        {/* Audio tracks */}
                        {audioTracks.map(track => (
                            <div key={track.id} className="flex h-16 border-b border-purple-500/20">
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
                                                        onClick={() => toggleAudioMute(track.id)}
                                                    >
                                                        {track.isMuted ? (
                                                            <VolumeX className="h-3 w-3" />
                                                        ) : (
                                                            <Volume2 className="h-3 w-3" />
                                                        )}
                                                    </Button>
                                                </TooltipTrigger>
                                                <TooltipContent>
                                                    <p>{track.isMuted ? 'Unmute' : 'Mute'} track</p>
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
                                    {/* Waveform visualization */}
                                    <div className="absolute inset-0 flex items-center">
                                        {/* Beautiful background for waveform */}
                                        <div 
                                            className="absolute h-12 inset-x-0 bg-gradient-to-r from-purple-900/20 via-purple-800/10 to-purple-900/20 rounded-md border border-purple-500/30"
                                            style={{ opacity: track.isMuted ? '0.4' : '1' }}
                                        />
                                        
                                        {/* Render waveform segments */}
                                        {track.waveform.map((segment, i) => {
                                            const position = (i / (track.waveform.length - 1 || 1)) * track.duration * scale;
                                            const gap = 1; // Small gap between segments for a cleaner look
                                            return (
                                                <div 
                                                    key={i}
                                                    className="absolute h-12 flex items-center justify-center"
                                                    style={{ 
                                                        left: `${position}px`,
                                                        opacity: track.isMuted ? '0.3' : '1'
                                                    }}
                                                >
                                                    <img 
                                                        src={segment} 
                                                        alt=""
                                                        className="h-full"
                                                    />
                                                </div>
                                            );
                                        })}
                                        
                                        {/* Add stylish track info overlay */}
                                        <div className="absolute left-3 top-1 text-xs text-white/80 font-medium pointer-events-none">
                                            <span className="bg-purple-600/40 px-1.5 py-0.5 rounded-sm backdrop-blur-sm">
                                                {track.name}
                                            </span>
                                        </div>
                                        
                                        {/* Duration indicator */}
                                        <div 
                                            className="absolute right-3 top-1 text-xs text-white/70 font-medium pointer-events-none"
                                        >
                                            <span className="bg-purple-700/30 px-1.5 py-0.5 rounded-sm backdrop-blur-sm">
                                                {track.duration.toFixed(1)}s
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
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