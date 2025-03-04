import React, { useState, useEffect } from 'react';
import { fabric } from 'fabric';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Bold, Italic, Underline, AlignLeft, AlignCenter, AlignRight } from 'lucide-react';

interface TextEditorProps {
  selectedObject: fabric.IText | null;
  canvas: fabric.Canvas | null;
}

const fonts = [
  'Arial',
  'Times New Roman',
  'Helvetica',
  'Courier New',
  'Georgia',
  'Verdana',
  'Impact'
];

const TextEditor: React.FC<TextEditorProps> = ({ selectedObject, canvas }) => {
  const [timelineVisible, setTimelineVisible] = useState(false);
  const [scrollAreaHeight, setScrollAreaHeight] = useState('calc(100vh - 60px)');

  // Effect to check if timeline is visible
  useEffect(() => {
    const checkTimelineVisibility = () => {
      // Check for timeline element
      const timelineElement = document.querySelector('[data-timeline="true"]');
      const timelineVisible = timelineElement !== null && window.getComputedStyle(timelineElement).display !== 'none';
      setTimelineVisible(timelineVisible);
      
      // Adjust height based on timeline visibility
      if (timelineVisible) {
        // Calculate timeline height (approximately 200px) or get actual height
        const timelineHeight = timelineElement ? timelineElement.clientHeight : 200;
        setScrollAreaHeight(`calc(100vh - 60px - ${timelineHeight}px)`);
      } else {
        setScrollAreaHeight('calc(100vh - 60px)');
      }
    };

    // Initial check
    checkTimelineVisibility();
    
    // Set up a mutation observer to detect changes to the DOM
    const observer = new MutationObserver(checkTimelineVisibility);
    observer.observe(document.body, { 
      childList: true, 
      subtree: true,
      attributes: true
    });
    
    // Also listen for resize events
    window.addEventListener('resize', checkTimelineVisibility);
    
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', checkTimelineVisibility);
    };
  }, []);

  if (!selectedObject || !canvas) return null;

  const updateText = (value: string) => {
    selectedObject.set('text', value);
    canvas.renderAll();
  };

  const updateFont = (value: string) => {
    selectedObject.set('fontFamily', value);
    canvas.renderAll();
  };

  const updateFontSize = (value: number) => {
    selectedObject.set('fontSize', value);
    canvas.renderAll();
  };

  const updateColor = (value: string) => {
    selectedObject.set('fill', value);
    canvas.renderAll();
  };

  const toggleBold = () => {
    selectedObject.set('fontWeight', selectedObject.fontWeight === 'bold' ? 'normal' : 'bold');
    canvas.renderAll();
  };

  const toggleItalic = () => {
    selectedObject.set('fontStyle', selectedObject.fontStyle === 'italic' ? 'normal' : 'italic');
    canvas.renderAll();
  };

  const toggleUnderline = () => {
    selectedObject.set('underline', !selectedObject.underline);
    canvas.renderAll();
  };

  const updateAlignment = (value: string) => {
    selectedObject.set('textAlign', value);
    canvas.renderAll();
  };

  return (
    <ScrollArea className="h-full" style={{ height: scrollAreaHeight }}>
      <div className="space-y-4 p-4">
        <div className="space-y-2">
          <Label>Text Content</Label>
          <Input
            value={selectedObject.text}
            onChange={(e) => updateText(e.target.value)}
            className="bg-purple-900/20 border-purple-500/20"
          />
        </div>

        <div className="space-y-2">
          <Label>Font Family</Label>
          <Select
            value={selectedObject.fontFamily}
            onValueChange={updateFont}
          >
            <SelectTrigger className="bg-purple-900/20 border-purple-500/20">
              <SelectValue placeholder="Select font" />
            </SelectTrigger>
            <SelectContent>
              {fonts.map((font) => (
                <SelectItem key={font} value={font}>
                  {font}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Font Size</Label>
          <div className="flex items-center gap-4">
            <Slider
              value={[selectedObject.fontSize || 40]}
              min={8}
              max={120}
              step={1}
              onValueChange={(value) => updateFontSize(value[0])}
              className="flex-1"
            />
            <span className="w-12 text-center">{selectedObject.fontSize || 40}px</span>
          </div>
        </div>

        <div className="space-y-2">
          <Label>Text Color</Label>
          <div className="flex items-center gap-2">
            <Input
              type="color"
              value={selectedObject.fill as string}
              onChange={(e) => updateColor(e.target.value)}
              className="w-10 h-10 p-1 bg-purple-900/20 border-purple-500/20"
            />
            <Input
              type="text"
              value={selectedObject.fill as string}
              onChange={(e) => updateColor(e.target.value)}
              className="flex-1 bg-purple-900/20 border-purple-500/20"
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label>Text Style</Label>
          <div className="flex items-center gap-2">
            <Button
              variant={selectedObject.fontWeight === 'bold' ? "default" : "outline"}
              size="sm"
              onClick={toggleBold}
              className="flex-1"
            >
              <Bold className="h-4 w-4" />
            </Button>
            <Button
              variant={selectedObject.fontStyle === 'italic' ? "default" : "outline"}
              size="sm"
              onClick={toggleItalic}
              className="flex-1"
            >
              <Italic className="h-4 w-4" />
            </Button>
            <Button
              variant={selectedObject.underline ? "default" : "outline"}
              size="sm"
              onClick={toggleUnderline}
              className="flex-1"
            >
              <Underline className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="space-y-2">
          <Label>Text Alignment</Label>
          <div className="flex items-center gap-2">
            <Button
              variant={selectedObject.textAlign === 'left' ? "default" : "outline"}
              size="sm"
              onClick={() => updateAlignment('left')}
              className="flex-1"
            >
              <AlignLeft className="h-4 w-4" />
            </Button>
            <Button
              variant={selectedObject.textAlign === 'center' ? "default" : "outline"}
              size="sm"
              onClick={() => updateAlignment('center')}
              className="flex-1"
            >
              <AlignCenter className="h-4 w-4" />
            </Button>
            <Button
              variant={selectedObject.textAlign === 'right' ? "default" : "outline"}
              size="sm"
              onClick={() => updateAlignment('right')}
              className="flex-1"
            >
              <AlignRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </ScrollArea>
  );
};

export default TextEditor;
