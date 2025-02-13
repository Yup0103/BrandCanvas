import React from 'react';
import { Progress } from '@/components/ui/progress';

export const RecommendationProgress: React.FC = () => {
  return (
    <div className="p-4 bg-white rounded-lg shadow">
      <h2 className="text-xl font-semibold mb-4">Implementation Progress</h2>
      <div className="space-y-4">
        <div>
          <div className="flex justify-between mb-2">
            <span className="text-sm font-medium">Overall Progress</span>
            <span className="text-sm text-muted-foreground">60%</span>
          </div>
          <Progress value={60} className="h-2" />
        </div>
      </div>
    </div>
  );
};
