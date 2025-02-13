import React from 'react';
import {
  Square,
  Circle,
  Triangle,
  Minus,
  Pentagon,
  Hexagon,
  Star,
  Diamond,
} from 'lucide-react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface ShapePopoverProps {
  onShapeSelect: (shape: string) => void;
  selectedShape: string;
  trigger: React.ReactNode;
}

const shapes = [
  { icon: Square, label: 'Rectangle', value: 'rect' },
  { icon: Circle, label: 'Circle', value: 'circle' },
  { icon: Triangle, label: 'Triangle', value: 'triangle' },
  { icon: Minus, label: 'Line', value: 'line' },
  { icon: Pentagon, label: 'Pentagon', value: 'pentagon' },
  { icon: Hexagon, label: 'Hexagon', value: 'hexagon' },
  { icon: Star, label: 'Star', value: 'star' },
  { icon: Diamond, label: 'Diamond', value: 'diamond' },
];

const ShapePopover: React.FC<ShapePopoverProps> = ({
  onShapeSelect,
  selectedShape,
  trigger
}) => {
  return (
    <Popover>
      <PopoverTrigger asChild>
        {trigger}
      </PopoverTrigger>
      <PopoverContent 
        className="w-64 p-2 grid grid-cols-4 gap-1 bg-gray-800/90 backdrop-blur-lg border-purple-500/20"
        sideOffset={5}
      >
        {shapes.map((shape) => (
          <Button
            key={shape.value}
            variant="ghost"
            size="icon"
            className={cn(
              'group relative aspect-square transition-all duration-200 ease-in-out',
              'hover:bg-purple-500/20 hover:scale-105',
              'active:scale-95',
              selectedShape === shape.value && 'bg-purple-500/30'
            )}
            onClick={() => onShapeSelect(shape.value)}
          >
            <shape.icon className="h-5 w-5 transition-transform group-hover:scale-110" />
            <span className="absolute -bottom-6 left-1/2 -translate-x-1/2 text-xs opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
              {shape.label}
            </span>
          </Button>
        ))}
      </PopoverContent>
    </Popover>
  );
};

export default ShapePopover;
