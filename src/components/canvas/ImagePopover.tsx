import React, { useRef } from 'react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { ImagePlus, FolderOpen } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ImagePopoverProps {
  trigger: React.ReactNode;
  onImageSelect: (file: File) => void;
  onNyxAssetSelect: () => void;
}

const ImagePopover: React.FC<ImagePopoverProps> = ({
  trigger,
  onImageSelect,
  onNyxAssetSelect,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onImageSelect(file);
    }
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        {trigger}
      </PopoverTrigger>
      <PopoverContent 
        className="w-64 bg-gray-800/90 backdrop-blur-lg border-purple-500/20 p-2"
        align="center"
        side="right"
      >
        <div className="flex flex-col gap-2">
          <input
            type="file"
            ref={fileInputRef}
            className="hidden"
            accept="image/*"
            onChange={handleFileSelect}
          />
          <Button
            variant="ghost"
            className={cn(
              'w-full flex items-center gap-2 justify-start hover:bg-purple-500/20',
              'group transition-all duration-200 ease-in-out'
            )}
            onClick={() => fileInputRef.current?.click()}
          >
            <ImagePlus className="h-4 w-4" />
            <span>Upload from Device</span>
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
      </PopoverContent>
    </Popover>
  );
};

export default ImagePopover;
