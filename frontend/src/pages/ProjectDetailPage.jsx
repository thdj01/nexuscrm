import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { Edit2, RefreshCw, Briefcase, Copy, Activity, ChevronLeft } from 'lucide-react';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';
import Spinner from '../components/common/Spinner';
import StatusBadge from '../components/common/StatusBadge';
import ProjectForm from '../components/project/ProjectForm';
import Modal from '../components/common/Modal';
import { Button, Card } from '../components/common/FormComponents';
import { StepProgressBar } from '../components/common/FormComponents.extended';
import PageHeader from '../components/common/PageHeader';
import { PROJECT_PERMISSIONS } from '../constants/permissions';
import {
  fetchProject as apiFetchProject,
  createProject as apiCreateProject,
  updateProject as apiUpdateProject,
  copyProject as apiCopyProject,
  uploadProjectDocuments,
  computeDelay,
  getProjectId,
} from '../api/projectService';

const getInquiryNumber = (project = {}) => (
  project?.inquiryNumber ||
  project?.inquiryReference?.inquiryId ||
  project?.sourceInquirySnapshot?.inquiryId ||
  ''
);


const PROJECT_SECTION_SCROLL_OFFSET = 150;

const getGridLetter = (index = 0) => String.fromCharCode(65 + Number(index || 0));

const PROJECT_STEPPER_COLORS = ['orange', 'purple', 'amber', 'green', 'cyan', 'rose', 'indigo'];
const getPlanningGridStepColor = (index = 0) => PROJECT_STEPPER_COLORS[index % PROJECT_STEPPER_COLORS.length];

const getPlanningGridElementId = (gridId) => `project-planning-grid-${String(gridId || '').trim()}`;

const normalizePlanningGridStep = (grid = {}, index = 0) => {
  const gridId = String(grid?.id || grid?.gridId || getGridLetter(index)).trim() || getGridLetter(index);
  return {
    id: gridId,
    label: grid?.label || `Grid ${gridId}`,
    title: grid?.title || grid?.name || grid?.gridName || `Project Planning Grid - ${gridId}`,
    color: grid?.color || getPlanningGridStepColor(index),
  };
};

const ProjectDetailPage = () => {
  const { id } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const toast = useToast();
  const { hasPermission, hasAnyPermission } = useAuth();

  const isNewProject = location.pathname === '/projects/new' || id === 'new';
  const canCreateProject = hasPermission(PROJECT_PERMISSIONS.CREATE);
  const canEditProject = hasPermission(PROJECT_PERMISSIONS.EDIT);
  const canManagePlanning = hasPermission(PROJECT_PERMISSIONS.PLANNING_GRID);
  const canAddPlanningGrid = hasPermission(PROJECT_PERMISSIONS.ADD_DUPLICATE_PLANNING_GRID);
  const canUpdateCompletion = hasPermission(PROJECT_PERMISSIONS.UPDATE_COMPLETION);
  const canMarkCompleted = hasPermission(PROJECT_PERMISSIONS.MARK_COMPLETED);
  const canOpenProjectEditor = hasAnyPermission([
    PROJECT_PERMISSIONS.EDIT,
    PROJECT_PERMISSIONS.PLANNING_GRID,
    PROJECT_PERMISSIONS.ADD_DUPLICATE_PLANNING_GRID,
    PROJECT_PERMISSIONS.UPDATE_COMPLETION,
    PROJECT_PERMISSIONS.MARK_COMPLETED,
  ]);
  const startsEditable = isNewProject
    ? canCreateProject
    : location.pathname.endsWith('/edit') && canOpenProjectEditor;

  // Creating a project is one atomic action. On the create screen, the creator
  // can fill the initial details, planning grid, completion state and documents.
  // After creation, each change is controlled by its individual permission key.
  const formCanEditProject = isNewProject ? canCreateProject : canEditProject;
  const formCanManagePlanning = isNewProject ? canCreateProject : canManagePlanning;
  const formCanAddPlanningGrid = isNewProject ? canCreateProject : canAddPlanningGrid;
  const formCanUpdateCompletion = isNewProject ? canCreateProject : canUpdateCompletion;
  const formCanMarkCompleted = isNewProject ? canCreateProject : canMarkCompleted;
  const formCanManageDocuments = isNewProject ? canCreateProject : canEditProject;

  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(!isNewProject);
  const [submitting, setSubmitting] = useState(false);
  const [copying, setCopying] = useState(false);
  const [showCopyConfirm, setShowCopyConfirm] = useState(false);
  const [readOnly, setReadOnly] = useState(!startsEditable);
  const [activeSection, setActiveSection] = useState(0);
  const [planningGridNavigation, setPlanningGridNavigation] = useState([]);
  const [selectedPlanningGridId, setSelectedPlanningGridId] = useState('A');
  const sectionRefs = useRef([]);

  const loadProject = useCallback(async () => {
    if (isNewProject) {
      setProject(null);
      setLoading(false);
      return;
    }

    if (!id) return;

    setLoading(true);
    try {
      const data = await apiFetchProject(id);
      setProject({ ...data, ...computeDelay(data) });
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to load project');
      navigate('/projects');
    } finally {
      setLoading(false);
    }
  }, [id, isNewProject, navigate, toast]);

  useEffect(() => {
    setReadOnly(!startsEditable);
  }, [startsEditable, id]);

  useEffect(() => {
    loadProject();
  }, [loadProject]);

  const planningGridSteps = useMemo(() => {
    if (planningGridNavigation.length > 0) {
      return planningGridNavigation.map(normalizePlanningGridStep);
    }

    const projectGrids = Array.isArray(project?.planningGrids) ? project.planningGrids : [];
    if (projectGrids.length > 0) {
      return projectGrids.map(normalizePlanningGridStep);
    }

    return [normalizePlanningGridStep({ gridId: 'A' }, 0)];
  }, [planningGridNavigation, project?.planningGrids]);

  const projectStepperSteps = useMemo(() => ([
    { label: 'Details', color: 'green' },
    { label: 'Planning', color: 'indigo' },
    { label: 'Documents', color: 'slate' },
  ]), []);

  useEffect(() => {
    setActiveSection((prev) => Math.min(prev, Math.max(0, projectStepperSteps.length - 1)));
  }, [projectStepperSteps.length]);

  useEffect(() => {
    if (!planningGridSteps.length) return;
    const selectedStillExists = planningGridSteps.some((gridStep) => String(gridStep.id).toUpperCase() === String(selectedPlanningGridId).toUpperCase());
    if (!selectedStillExists) {
      setSelectedPlanningGridId(planningGridSteps[0]?.id || 'A');
    }
  }, [planningGridSteps, selectedPlanningGridId]);

  const selectedPlanningGridIndex = Math.max(0, planningGridSteps.findIndex((gridStep) => String(gridStep.id).toUpperCase() === String(selectedPlanningGridId).toUpperCase()));

  const activePlanningGridId = selectedPlanningGridId || planningGridSteps[0]?.id || 'A';

  const setProjectSectionRef = useCallback((index, element) => {
    sectionRefs.current[index] = element;
  }, []);

  const getProjectSectionElement = useCallback((index) => {
    if (index === 0) {
      return sectionRefs.current[0] || document.getElementById('project-section-details');
    }

    if (index === 2) {
      return sectionRefs.current[2] || document.getElementById('project-section-documents');
    }

    const gridElement = activePlanningGridId
      ? document.getElementById(getPlanningGridElementId(activePlanningGridId))
      : null;

    return gridElement || sectionRefs.current[1] || document.getElementById('project-section-planning');
  }, [activePlanningGridId]);

  const scrollToProjectSection = useCallback((index) => {
    const target = getProjectSectionElement(index);
    if (!target) return;

    const main = document.querySelector('main');

    if (main) {
      const mainRect = main.getBoundingClientRect();
      const targetRect = target.getBoundingClientRect();
      main.scrollTo({
        top: Math.max(0, main.scrollTop + targetRect.top - mainRect.top - PROJECT_SECTION_SCROLL_OFFSET),
        behavior: 'smooth',
      });
      setActiveSection(index);
      return;
    }

    window.scrollTo({
      top: Math.max(0, window.scrollY + target.getBoundingClientRect().top - PROJECT_SECTION_SCROLL_OFFSET),
      behavior: 'smooth',
    });
    setActiveSection(index);
  }, [getProjectSectionElement]);

  useEffect(() => {
    const updateActiveSection = () => {
      const activationLine = PROJECT_SECTION_SCROLL_OFFSET + 70;
      let nextActive = 0;
      let bestDistance = Number.POSITIVE_INFINITY;

      projectStepperSteps.forEach((_step, index) => {
        const section = getProjectSectionElement(index);
        if (!section) return;
        const distance = Math.abs(section.getBoundingClientRect().top - activationLine);
        if (distance < bestDistance) {
          bestDistance = distance;
          nextActive = index;
        }
      });

      if (Number.isFinite(bestDistance)) {
        setActiveSection((prev) => (prev === nextActive ? prev : nextActive));
      }
    };

    const main = document.querySelector('main');
    updateActiveSection();
    main?.addEventListener('scroll', updateActiveSection, { passive: true });
    window.addEventListener('scroll', updateActiveSection, { passive: true });
    window.addEventListener('resize', updateActiveSection);
    return () => {
      main?.removeEventListener('scroll', updateActiveSection);
      window.removeEventListener('scroll', updateActiveSection);
      window.removeEventListener('resize', updateActiveSection);
    };
  }, [loading, readOnly, project?._id, getProjectSectionElement, projectStepperSteps]);

  const handleCreate = async (formData) => {
    setSubmitting(true);
    try {
      const pendingDocuments = Array.isArray(formData?._pendingDocuments) ? formData._pendingDocuments : [];
      const payload = { ...formData };
      delete payload._pendingDocuments;

      const created = await apiCreateProject(payload);
      const createdProjectId = getProjectId(created);

      if (pendingDocuments.length > 0 && createdProjectId) {
        await uploadProjectDocuments(createdProjectId, pendingDocuments);
      }

      toast.success(
        pendingDocuments.length > 0
          ? 'Project created and documents uploaded successfully'
          : 'Project created successfully'
      );
      navigate(createdProjectId ? `/projects/${createdProjectId}` : '/projects');
      return true;
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create project');
      return false;
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = async (formData) => {
    if (!project?._id) return;

    setSubmitting(true);
    try {
      const updated = await apiUpdateProject(project._id, formData);
      toast.success('Project updated successfully');
      setProject({ ...updated, ...computeDelay(updated) });
      setReadOnly(true);
      navigate(`/projects/${project._id}`, { replace: true });
      return true;
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update project');
      return false;
    } finally {
      setSubmitting(false);
    }
  };

  const handleCopy = async () => {
    // Use the route param first because it is always the loaded project's URL id.
    // This avoids sending a populated project object as /projects/[object Object]/copy.
    const sourceProjectId = getProjectId(id) || getProjectId(project);
    if (!sourceProjectId || copying) {
      toast.error('Invalid project id. Please refresh the page and try again.');
      return;
    }

    setShowCopyConfirm(false);
    setCopying(true);
    try {
      const copiedProject = await apiCopyProject(sourceProjectId);
      const copiedProjectId = getProjectId(copiedProject);

      if (!copiedProjectId) {
        toast.success('Project copied successfully');
        toast.error('Copied project id was not returned. Please refresh the project list.');
        navigate('/projects');
        return;
      }

      toast.success('Project copied successfully');
      navigate(`/projects/${copiedProjectId}`);
    } catch (err) {
      toast.error(err.response?.data?.message || err.message || 'Failed to copy project');
    } finally {
      setCopying(false);
    }
  };

  const handlePlanningGridSelect = (gridId) => {
    setSelectedPlanningGridId(gridId);
    setActiveSection(1);
    requestAnimationFrame(() => {
      const gridElement = document.getElementById(getPlanningGridElementId(gridId));
      const target = gridElement || sectionRefs.current[1] || document.getElementById('project-section-planning');
      if (!target) return;
      const main = document.querySelector('main');
      if (main) {
        const mainRect = main.getBoundingClientRect();
        const targetRect = target.getBoundingClientRect();
        main.scrollTo({
          top: Math.max(0, main.scrollTop + targetRect.top - mainRect.top - PROJECT_SECTION_SCROLL_OFFSET),
          behavior: 'smooth',
        });
        return;
      }
      window.scrollTo({
        top: Math.max(0, window.scrollY + target.getBoundingClientRect().top - PROJECT_SECTION_SCROLL_OFFSET),
        behavior: 'smooth',
      });
    });
  };

  const goToPlanningGrid = (direction) => {
    if (!planningGridSteps.length) return;
    const nextIndex = Math.min(
      planningGridSteps.length - 1,
      Math.max(0, selectedPlanningGridIndex + direction)
    );
    handlePlanningGridSelect(planningGridSteps[nextIndex]?.id || 'A');
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!project && !isNewProject) {
    return (
      <Card className="p-8 text-center">
        <p className="font-medium text-gray-800">Project not found</p>
        <Button variant="secondary" className="mt-4" onClick={() => navigate('/projects')}>
          Back to Projects
        </Button>
      </Card>
    );
  }

  const inquiryNumber = isNewProject ? '' : getInquiryNumber(project);

  return (
    <div className="fade-in w-full min-w-0 max-w-full space-y-3 pb-0">
      <PageHeader bleed="main" bleedTop={false} contentClassName="px-1 sm:px-2">
          <div className={`grid min-w-0 grid-cols-1 gap-x-3 gap-y-2 lg:items-center ${isNewProject ? 'lg:grid-cols-[minmax(190px,0.8fr)_minmax(380px,1.2fr)]' : 'lg:grid-cols-[minmax(190px,0.8fr)_auto_minmax(380px,1.2fr)]'}`}>
            <div className="min-w-0 justify-self-start">
              <button
                type="button"
                onClick={() => navigate('/projects')}
                className="mb-1 inline-flex items-center gap-1 rounded-md text-sm font-medium text-gray-500 transition hover:text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
              >
                <ChevronLeft size={16} strokeWidth={2.25} />
                Back to Projects
              </button>
              <div className="flex min-w-0 flex-wrap items-center gap-2 lg:min-h-[30px]">
                <Briefcase size={18} className="shrink-0 text-blue-600" />
                <h2 className="truncate text-base font-bold text-gray-900 sm:text-lg">
                  {isNewProject ? 'New Project' : (project?.projectId || 'Project Details')}
                </h2>
                {!isNewProject && <StatusBadge status={project.projectStatus} />}
                {inquiryNumber && (
                  <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                    Inquiry No. {inquiryNumber}
                  </span>
                )}
              </div>

            </div>

            {!isNewProject && (
              <div className="flex flex-wrap items-center justify-center gap-1.5">
                <Button
                  variant="secondary"
                  onClick={loadProject}
                  title="Refresh"
                  aria-label="Refresh"
                  className="h-8 rounded-lg px-3 text-xs"
                >
                  <RefreshCw size={16} strokeWidth={2.25} /> Refresh
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => navigate(`/projects/${project?._id || id}/activity`)}
                  title="Activity Graph"
                  aria-label="Activity Graph"
                  className="h-8 rounded-lg px-3 text-xs"
                >
                  <Activity size={16} strokeWidth={2.25} /> Activity
                </Button>
                {canCreateProject && (
                  <Button
                    variant="secondary"
                    onClick={() => setShowCopyConfirm(true)}
                    loading={copying}
                    title="Copy Project"
                    aria-label="Copy Project"
                    className="h-8 rounded-lg px-3 text-xs"
                  >
                    <Copy size={16} strokeWidth={2.25} /> Copy
                  </Button>
                )}
                {readOnly && canOpenProjectEditor && (
                  <Button
                    onClick={() => setReadOnly(false)}
                    title="Edit Project"
                    aria-label="Edit Project"
                    className="h-8 rounded-lg px-3 text-xs"
                  >
                    <Edit2 size={16} strokeWidth={2.25} /> Edit
                  </Button>
                )}
              </div>
            )}

            <div className="w-full min-w-0 justify-self-end overflow-hidden lg:ml-auto lg:max-w-[640px]">
              <div className="ml-auto w-fit max-w-full">
                <StepProgressBar
                  steps={projectStepperSteps}
                  currentStep={activeSection}
                  onStepClick={scrollToProjectSection}
                  align="end"
                />
              </div>

              <div className="mt-1 ml-auto flex w-full max-w-full min-w-0 items-center justify-end gap-1.5 sm:max-w-[575px]">
                <button
                  type="button"
                  onClick={() => goToPlanningGrid(-1)}
                  disabled={selectedPlanningGridIndex <= 0}
                  className="inline-flex h-7 items-center justify-center rounded-lg border border-gray-200 bg-white px-2.5 text-xs font-semibold text-gray-500 shadow-sm transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  ‹ Prev
                </button>

                <select
                  value={activePlanningGridId}
                  onChange={(event) => handlePlanningGridSelect(event.target.value)}
                  onFocus={() => setActiveSection(1)}
                  className="h-7 min-w-0 flex-1 rounded-lg border border-indigo-200 bg-indigo-50 px-2.5 text-xs font-semibold text-indigo-700 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 sm:max-w-xs"
                >
                  {planningGridSteps.map((gridStep, index) => (
                    <option key={gridStep.id || index} value={gridStep.id}>
                      {index + 1}. {gridStep.title || gridStep.label || `Project Planning Grid - ${gridStep.id}`}
                    </option>
                  ))}
                </select>

                <button
                  type="button"
                  onClick={() => goToPlanningGrid(1)}
                  disabled={selectedPlanningGridIndex >= planningGridSteps.length - 1}
                  className="inline-flex h-7 items-center justify-center rounded-lg border border-gray-200 bg-white px-2.5 text-xs font-semibold text-gray-700 shadow-sm transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Next ›
                </button>
              </div>
            </div>
          </div>
      </PageHeader>

      <Modal
        isOpen={showCopyConfirm}
        onClose={() => { if (!copying) setShowCopyConfirm(false); }}
        title="Copy Project"
        size="sm"
      >
        <div className="space-y-5">
          <p className="text-sm font-medium text-gray-700">
            Do you really want to copy this project?
          </p>
          <div className="flex justify-end gap-3">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setShowCopyConfirm(false)}
              disabled={copying}
            >
              No
            </Button>
            <Button type="button" onClick={handleCopy} loading={copying}>
              Yes
            </Button>
          </div>
        </div>
      </Modal>


      <ProjectForm
        initialData={isNewProject ? null : project}
        onSubmit={isNewProject ? handleCreate : handleEdit}
        loading={submitting}
        readOnly={isNewProject ? false : readOnly}
        canEditProject={formCanEditProject}
        canManagePlanning={formCanManagePlanning}
        canAddPlanningGrid={formCanAddPlanningGrid}
        canUpdateCompletion={formCanUpdateCompletion}
        canMarkCompleted={formCanMarkCompleted}
        canManageDocuments={formCanManageDocuments}
        setSectionRef={setProjectSectionRef}
        setPlanningGridNavigation={setPlanningGridNavigation}
        activeSection={activeSection}
        activePlanningGridId={activePlanningGridId}
        isDocumentsActive={activeSection === projectStepperSteps.length - 1}
      />
    </div>
  );
};

export default ProjectDetailPage;