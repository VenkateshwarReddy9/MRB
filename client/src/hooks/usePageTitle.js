import { useLocation } from 'react-router-dom';
import { useMemo } from 'react';

export default function usePageTitle() {
  const { pathname } = useLocation();
  return useMemo(() => {
    if (pathname.match(/^\/employees\/.*\/edit$/)) {
      return 'Edit Employee';
    }
    const titles = {
      '/': 'Dashboard',
      '/my-availability': 'My Availability',
      '/my-schedule': 'My Schedule',
      '/users': 'User Access',
      '/employees': 'Employees',
      '/rota': 'Rota',
      '/availability-requests': 'Time Off Requests',
      '/shift-templates': 'Shift Templates',
      '/timesheet': 'Timesheets',
      '/reports/labor': 'Labor Report',
      '/activity-log': 'Activity Log',
      '/time-entries': 'Time Entries'
    };
    return titles[pathname] || 'Dashboard';
  }, [pathname]);
}
