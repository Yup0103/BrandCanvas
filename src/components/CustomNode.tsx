import React from 'react';
import { Handle, Position } from 'reactflow';

interface CustomNodeProps {
  data: {
    label: string;
    type?: string;
    status?: string;
  };
}

const CustomNode: React.FC<CustomNodeProps> = ({ data }) => {
  const getNodeStyle = () => {
    switch (data.status) {
      case 'completed':
        return 'bg-green-100 border-green-500';
      case 'in-progress':
        return 'bg-blue-100 border-blue-500';
      case 'pending':
        return 'bg-yellow-100 border-yellow-500';
      default:
        return 'bg-gray-100 border-gray-500';
    }
  };

  return (
    <div className={`px-4 py-2 rounded-lg border-2 ${getNodeStyle()}`}>
      <Handle type="target" position={Position.Top} className="w-3 h-3" />
      <div className="font-medium">{data.label}</div>
      {data.type && (
        <div className="text-sm text-muted-foreground">{data.type}</div>
      )}
      <Handle type="source" position={Position.Bottom} className="w-3 h-3" />
    </div>
  );
};

export default CustomNode;
