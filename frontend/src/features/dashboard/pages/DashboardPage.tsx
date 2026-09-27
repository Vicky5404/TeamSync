import { PageHeader } from '@/components/common/PageHeader';
import { useCurrentUser } from '@/features/auth/api/auth.queries';
import { useActiveOrganization } from '@/features/organizations/active-organization';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { getGreeting } from '@/utils/date';

import { DashboardStats } from '../components/DashboardStats';
import { MyTasksCard } from '../components/MyTasksCard';
import { ProjectProgressCard } from '../components/ProjectProgressCard';
import { RecentActivityCard } from '../components/RecentActivityCard';
import { TaskCompletionCard } from '../components/TaskCompletionCard';
import { TeamWorkloadCard } from '../components/TeamWorkloadCard';

export function DashboardPage() {
  useDocumentTitle('Dashboard');
  const organization = useActiveOrganization();
  const { data: user } = useCurrentUser();
  const firstName = user?.name.split(' ')[0];

  return (
    <div className="space-y-6">
      <PageHeader
        title={firstName ? `${getGreeting()}, ${firstName}` : 'Dashboard'}
        description={`Here's what's happening across ${organization.name}.`}
      />

      <DashboardStats />

      <div className="grid gap-6 xl:grid-cols-3">
        <TaskCompletionCard className="xl:col-span-2" />
        <MyTasksCard />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <ProjectProgressCard />
        <TeamWorkloadCard />
      </div>

      <RecentActivityCard />
    </div>
  );
}
