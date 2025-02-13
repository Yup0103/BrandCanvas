import React from 'react';
import { Canvas, IText } from 'fabric';
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
import { Bold, Italic, Underline, AlignLeft, AlignCenter, AlignRight } from 'lucide-react';

interface TextEditorProps {
  selectedObject: IText | null;
  canvas: Canvas | null;
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
            value={[selectedObject.fontSize || 20]}
            onValueChange={(value) => updateFontSize(value[0])}
            min={8}
            max={200}
            step={1}
            className="flex-1"
          />
          <span className="w-12 text-center">{selectedObject.fontSize}px</span>
        </div>
      </div>

      <div className="space-y-2">
        <Label>Color</Label>
        <div className="flex items-center gap-2">
          <Input
            type="color"
            value={selectedObject.fill as string}
            onChange={(e) => updateColor(e.target.value)}
            className="w-12 h-8 p-0 bg-transparent border-none"
          />
          <Input
            value={selectedObject.fill as string}
            onChange={(e) => updateColor(e.target.value)}
            className="flex-1 bg-purple-900/20 border-purple-500/20"
            placeholder="#000000"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label>Style</Label>
        <div className="flex items-center gap-2">
          <Button
            variant={selectedObject.fontWeight === 'bold' ? 'default' : 'ghost'}
            size="icon"
            onClick={toggleBold}
          >
            <Bold className="h-4 w-4" />
          </Button>
          <Button
            variant={selectedObject.fontStyle === 'italic' ? 'default' : 'ghost'}
            size="icon"
            onClick={toggleItalic}
          >
            <Italic className="h-4 w-4" />
          </Button>
          <Button
            variant={selectedObject.underline ? 'default' : 'ghost'}
            size="icon"
            onClick={toggleUnderline}
          >
            <Underline className="h-4 w-4" />
          </Button>
          <div className="w-px h-6 bg-purple-500/20" />
          <Button
            variant={selectedObject.textAlign === 'left' ? 'default' : 'ghost'}
            size="icon"
            onClick={() => updateAlignment('left')}
          >
            <AlignLeft className="h-4 w-4" />
          </Button>
          <Button
            variant={selectedObject.textAlign === 'center' ? 'default' : 'ghost'}
            size="icon"
            onClick={() => updateAlignment('center')}
          >
            <AlignCenter className="h-4 w-4" />
          </Button>
          <Button
            variant={selectedObject.textAlign === 'right' ? 'default' : 'ghost'}
            size="icon"
            onClick={() => updateAlignment('right')}
          >
            <AlignRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
};

export default TextEditor;
