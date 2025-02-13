import React from 'react';

export const TopCampaignsTable: React.FC = () => {
  return (
    <div className="p-4 bg-white rounded-lg shadow">
      <h2 className="text-xl font-semibold mb-4">Top Campaigns</h2>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b">
              <th className="text-left p-2">Campaign</th>
              <th className="text-left p-2">Status</th>
              <th className="text-left p-2">Performance</th>
            </tr>
          </thead>
          <tbody>
            {/* Add your table rows here */}
          </tbody>
        </table>
      </div>
    </div>
  );
};
