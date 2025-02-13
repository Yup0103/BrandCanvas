import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { Recommendation } from './RecommendationsPanel';

interface CampaignItemProps {
  id: number;
  name: string;
  status: 'active' | 'paused' | 'completed';
  platform: 'google' | 'meta' | 'linkedin';
  metrics: {
    impressions: number;
    clicks: number;
    conversions: number;
    spend: number;
    target: {
      conversions: number;
    };
  };
  isExpanded?: boolean;
  performanceData: Array<{
    date: string;
    impressions: number;
    clicks: number;
    costPerConversion: number;
  }>;
  onToggleExpand: () => void;
  onApplyRecommendation: (recommendation: Recommendation) => void;
  recommendations: Recommendation[];
  onEditCampaign: (id: number, updates: Partial<CampaignItemProps>) => void;
}

const CampaignItem: React.FC<CampaignItemProps> = ({
  id,
  name,
  status,
  platform,
  metrics,
  isExpanded,
  performanceData,
  onToggleExpand,
  onApplyRecommendation,
  recommendations,
  onEditCampaign,
}) => {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-500';
      case 'paused':
        return 'bg-yellow-500';
      case 'completed':
        return 'bg-blue-500';
      default:
        return 'bg-gray-500';
    }
  };

  return (
    <Card className="w-full bg-[#1A0B2E] border-purple-500/20">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <CardTitle className="text-lg font-semibold text-purple-50">{name}</CardTitle>
            <Badge className={getStatusColor(status)}>{status}</Badge>
            <Badge variant="outline" className="border-purple-500/40 text-purple-300">
              {platform}
            </Badge>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={onToggleExpand}
            className="text-purple-300 hover:text-purple-100 hover:bg-purple-500/10"
          >
            {isExpanded ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div>
            <p className="text-sm text-purple-300/60">Spend</p>
            <p className="text-lg font-medium text-purple-50">
              ${metrics.spend.toLocaleString()}
            </p>
          </div>
          <div>
            <p className="text-sm text-purple-300/60">Conversions</p>
            <p className="text-lg font-medium text-purple-50">
              {metrics.conversions.toLocaleString()}
            </p>
          </div>
          <div>
            <p className="text-sm text-purple-300/60">Impressions</p>
            <p className="text-lg font-medium text-purple-50">
              {metrics.impressions.toLocaleString()}
            </p>
          </div>
          <div>
            <p className="text-sm text-purple-300/60">Clicks</p>
            <p className="text-lg font-medium text-purple-50">
              {metrics.clicks.toLocaleString()}
            </p>
          </div>
        </div>

        {isExpanded && (
          <div className="mt-6 space-y-4">
            {/* Performance Data */}
            <div className="bg-purple-900/20 p-4 rounded-lg">
              <h4 className="text-sm font-medium text-purple-200 mb-3">Performance History</h4>
              <div className="space-y-2">
                {performanceData.map((data, index) => (
                  <div key={index} className="grid grid-cols-4 gap-4 text-sm">
                    <span className="text-purple-300">{data.date}</span>
                    <span className="text-purple-100">{data.impressions.toLocaleString()} imp.</span>
                    <span className="text-purple-100">{data.clicks.toLocaleString()} clicks</span>
                    <span className="text-purple-100">${data.costPerConversion.toFixed(2)} CPC</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Recommendations */}
            {recommendations.length > 0 && (
              <div className="bg-purple-900/20 p-4 rounded-lg">
                <h4 className="text-sm font-medium text-purple-200 mb-3">Recommendations</h4>
                <div className="space-y-3">
                  {recommendations.map((rec, index) => (
                    <div key={index} className="flex items-center justify-between">
                      <div>
                        <p className="text-purple-100">{rec.title}</p>
                        <p className="text-sm text-purple-300/60">{rec.details}</p>
                      </div>
                      <Button
                        size="sm"
                        onClick={() => onApplyRecommendation(rec)}
                        className="bg-purple-500 hover:bg-purple-600 text-white"
                      >
                        Apply
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default CampaignItem;
