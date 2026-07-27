import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ChevronLeft, RefreshCw } from 'lucide-react';
import { useToast } from '../context/ToastContext';
import Spinner from '../components/common/Spinner';
import StatusBadge from '../components/common/StatusBadge';
import ProjectActivityLogHistory from '../components/activity/ProjectActivityLogHistory';
import { Button, Card } from '../components/common/FormComponents';
import { fetchProject as apiFetchProject, computeDelay } from '../api/projectService';

const getInquiryNumber = (project = {}) => (
  project?.inquiryNumber ||
  project?.inquiryReference?.inquiryId ||
  project?.sourceInquirySnapshot?.inquiryId ||
  ''
);

const ProjectActivityPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const toast = useToast();
  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadProject = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const data = await apiFetchProject(id);
      setProject({ ...data, ...computeDelay(data) });
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to load project activity');
      navigate('/projects');
    } finally {
      setLoading(false);
    }
  }, [id, navigate, toast]);

  useEffect(() => {
    loadProject();
  }, [loadProject]);

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!project) {
    return (
      <Card className="p-8 text-center">
        <p className="font-medium text-gray-800">Project activity not found</p>
        <Button variant="secondary" className="mt-4" onClick={() => navigate('/projects')}>
          Back to Projects
        </Button>
      </Card>
    );
  }

  const inquiryNumber = getInquiryNumber(project);
  const focusDepartment = searchParams.get('department') || '';
  const focusGridId = searchParams.get('gridId') || '';

  return (
    <div className="fade-in mx-auto w-full max-w-none space-y-4 pb-8">
      <div className="sticky top-0 z-20 -mx-3 rounded-b-xl border-b border-gray-200 bg-gray-50/95 px-3 py-2 shadow-sm backdrop-blur sm:-mx-6 sm:px-6">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <button
              type="button"
              onClick={() => navigate(`/projects/${project._id || id}`)}
              className="mb-1 flex items-center gap-1 text-xs font-medium text-gray-500 transition-colors hover:text-gray-800"
            >
              <ChevronLeft size={14} /> Back to Project
            </button>
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <h2 className="truncate text-lg font-bold text-gray-900">
                {project.projectId || project.projectName || 'Project'} Activity
              </h2>
              <StatusBadge status={project.projectStatus} />
              {inquiryNumber && (
                <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
                  Inquiry No. {inquiryNumber}
                </span>
              )}
            </div>
            <p className="mt-0.5 text-xs text-gray-500">
              Department-wise and panel-wise activity graphs with the latest activity feed.
            </p>
          </div>

          <Button size="sm" variant="secondary" onClick={loadProject} className="flex items-center gap-1.5">
            <RefreshCw size={13} /> Refresh Project
          </Button>
        </div>
      </div>

      <ProjectActivityLogHistory
        project={project}
        projectId={project._id || id}
        focusDepartment={focusDepartment}
        focusGridId={focusGridId}
      />
    </div>
  );
};

export default ProjectActivityPage;
