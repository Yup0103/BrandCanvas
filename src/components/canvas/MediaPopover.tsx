import React, { useRef } from 'react';
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { ImagePlus, FolderOpen, VideoIcon, Music } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';

interface MediaPopoverProps {
    trigger: React.ReactNode;
    onImageSelect: (file: File) => void;
    onVideoSelect: (file: File) => void;
    onAudioSelect: (file: File) => void;
    onNyxAssetSelect: () => void;
}

const MediaPopover: React.FC<MediaPopoverProps> = ({
    trigger,
    onImageSelect,
    onVideoSelect,
    onAudioSelect,
    onNyxAssetSelect,
}) => {
    const imageInputRef = useRef<HTMLInputElement>(null);
    const videoInputRef = useRef<HTMLInputElement>(null);
    const audioInputRef = useRef<HTMLInputElement>(null);

    const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            onImageSelect(file);
        }
    };

    const handleVideoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            onVideoSelect(file);
        }
    };

    const handleAudioSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            onAudioSelect(file);
        }
    };

    return (
        <Popover>
            <PopoverTrigger asChild>
                {trigger}
            </PopoverTrigger>
            <PopoverContent
                className="w-72 bg-gray-800/90 backdrop-blur-lg border-purple-500/20 p-2"
                align="center"
                side="right"
            >
                <Tabs defaultValue="image" className="w-full">
                    <TabsList className="grid grid-cols-3 mb-2">
                        <TabsTrigger value="image">Image</TabsTrigger>
                        <TabsTrigger value="video">Video</TabsTrigger>
                        <TabsTrigger value="audio">Audio</TabsTrigger>
                    </TabsList>

                    <TabsContent value="image" className="mt-0">
                        <div className="flex flex-col gap-2">
                            <input
                                type="file"
                                ref={imageInputRef}
                                className="hidden"
                                accept="image/*"
                                onChange={handleImageSelect}
                            />
                            <Button
                                variant="ghost"
                                className={cn(
                                    'w-full flex items-center gap-2 justify-start hover:bg-purple-500/20',
                                    'group transition-all duration-200 ease-in-out'
                                )}
                                onClick={() => imageInputRef.current?.click()}
                            >
                                <ImagePlus className="h-4 w-4" />
                                <span>Upload Image</span>
                            </Button>
                            <Button
                                variant="ghost"
                                className={cn(
                                    'w-full flex items-center gap-2 justify-start hover:bg-purple-500/20',
                                    'group transition-all duration-200 ease-in-out'
                                )}
                                onClick={onNyxAssetSelect}
                            >
                                <FolderOpen className="h-4 w-4" />
                                <span>Browse Nyx Assets</span>
                            </Button>
                        </div>
                    </TabsContent>

                    <TabsContent value="video" className="mt-0">
                        <div className="flex flex-col gap-2">
                            <input
                                type="file"
                                ref={videoInputRef}
                                className="hidden"
                                accept="video/*"
                                onChange={handleVideoSelect}
                            />
                            <Button
                                variant="ghost"
                                className={cn(
                                    'w-full flex items-center gap-2 justify-start hover:bg-purple-500/20',
                                    'group transition-all duration-200 ease-in-out'
                                )}
                                onClick={() => videoInputRef.current?.click()}
                            >
                                <VideoIcon className="h-4 w-4" />
                                <span>Upload Video</span>
                            </Button>
                        </div>
                    </TabsContent>

                    <TabsContent value="audio" className="mt-0">
                        <div className="flex flex-col gap-2">
                            <input
                                type="file"
                                ref={audioInputRef}
                                className="hidden"
                                accept="audio/*"
                                onChange={handleAudioSelect}
                            />
                            <Button
                                variant="ghost"
                                className={cn(
                                    'w-full flex items-center gap-2 justify-start hover:bg-purple-500/20',
                                    'group transition-all duration-200 ease-in-out'
                                )}
                                onClick={() => audioInputRef.current?.click()}
                            >
                                <Music className="h-4 w-4" />
                                <span>Upload Audio</span>
                            </Button>
                        </div>
                    </TabsContent>
                </Tabs>
            </PopoverContent>
        </Popover>
    );
};

export default MediaPopover; 