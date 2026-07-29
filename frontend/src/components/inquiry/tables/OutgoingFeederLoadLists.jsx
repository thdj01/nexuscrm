import React from 'react';
import { ListChecks } from 'lucide-react';

import InquiryLoadTable from './InquiryLoadTable';
import {
  getFeederLoadRows,
  normalizeFeederLoadDetails,
  updateFeederLoadRows,
} from '../../../utils/feederLoadDetails';

const toneClasses = {
  orange: 'border-orange-200 bg-orange-50/40 text-orange-700',
  violet: 'border-violet-200 bg-violet-50/40 text-violet-700',
  blue: 'border-blue-200 bg-blue-50/40 text-blue-700',
};

const OutgoingFeederLoadLists = ({
  feederTypes = [],
  groups = [],
  onChange,
  disabled = false,
  errors = {},
  tone = 'orange',
}) => {
  const normalizedGroups = normalizeFeederLoadDetails({ feederTypes, groups });

  if (!normalizedGroups.length) return null;

  return (
    <div className="space-y-5">
      {normalizedGroups.map((group) => (
        <div
          key={group.feederType}
          className={`rounded-2xl border p-4 sm:p-5 ${toneClasses[tone] || toneClasses.orange}`}
        >
          <div className="mb-4 flex items-start gap-3">
            <div className="mt-0.5 rounded-xl bg-white/90 p-2 shadow-sm">
              <ListChecks size={18} />
            </div>
            <div>
              <h4 className="text-sm font-semibold text-slate-900">
                {group.feederType} Load List
              </h4>
              <p className="mt-0.5 text-xs text-slate-500">
                Add each motor or load required for this outgoing feeder.
              </p>
            </div>
          </div>

          <div className="rounded-xl bg-white/90 p-4 text-slate-700 shadow-sm">
            <InquiryLoadTable
              rows={getFeederLoadRows(normalizedGroups, group.feederType)}
              onChange={(updatedRows) => onChange?.(
                updateFeederLoadRows(normalizedGroups, group.feederType, updatedRows)
              )}
              showRemarks
              errors={errors}
              minRows={1}
              disabled={disabled}
            />
          </div>
        </div>
      ))}
    </div>
  );
};

export default OutgoingFeederLoadLists;
