import React from 'react';

const ExportModal = React.lazy(function loadExportModal() {
  return import('@/features/export/components/ExportModal').then((module) => ({ default: module.ExportModal }));
});

export { ExportModal };
