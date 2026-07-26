import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { API_URL } from '../config';
import { createEntityIndex } from '../utils/entityIndex';
import { createSearchIndex } from '../utils/searchIndex';
import { resolveAudience } from '../utils/audienceRegistry';
import { SessionService } from '../utils/sessionService';
import { PERMISSIONS, hasPermission } from '../utils/permissionRegistry';

const EntityContext = createContext(null);
const empty = { students: [], lecturers: [], groups: [], majors: [], departments: [], levels: [], courses: [] };

const scopedUrl = (path, user) => {
  const collegeId = user?.role === 'SUPER_ADMIN' ? localStorage.getItem('superadmin_selectedCollegeId') : user?.collegeId;
  return collegeId ? `${API_URL}${path}${path.includes('?') ? '&' : '?'}collegeId=${collegeId}` : `${API_URL}${path}`;
};

export function EntityProvider({ children }) {
  const [entities, setEntities] = useState(empty);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    const user = SessionService.getUser();
    const token = SessionService.getToken();
    if (!user) { setEntities(empty); return; }
    setLoading(true);
    try {
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const requests = [
        axios.get(scopedUrl('/api/departments', user)), axios.get(scopedUrl('/api/majors', user)),
        axios.get(scopedUrl('/api/levels', user)), axios.get(scopedUrl('/api/groups', user)),
      ];
      if (hasPermission(user, PERMISSIONS.ACCESS_ADMIN_PORTAL)) {
        requests.push(axios.get(scopedUrl('/api/students', user), { headers }));
        requests.push(axios.get(scopedUrl('/api/lecturers', user), { headers }));
        requests.push(axios.get(scopedUrl('/api/schedules', user), { headers }));
      }
      const results = await Promise.allSettled(requests);
      const dataAt = (i) => results[i]?.status === 'fulfilled' && results[i].value.data?.success ? results[i].value.data.data ?? [] : [];
      const schedules = dataAt(6);
      const courses = Array.from(new Map(schedules.map((s) => [String(s.subject?.id ?? s.subject?.code ?? s.subject?.name), s.subject]).filter(([, s]) => s)).values());
      setEntities({ departments: dataAt(0), majors: dataAt(1), levels: dataAt(2), groups: dataAt(3), students: dataAt(4), lecturers: dataAt(5), courses });
    } finally { setLoading(false); }
  }, []);

  useEffect(() => {
    refresh();
    window.addEventListener('MANAR_COLLEGE_SWITCH', refresh);
    window.addEventListener('MANAR_SESSION_CHANGED', refresh);
    return () => { window.removeEventListener('MANAR_COLLEGE_SWITCH', refresh); window.removeEventListener('MANAR_SESSION_CHANGED', refresh); };
  }, [refresh]);

  const value = useMemo(() => {
    const index = createEntityIndex(entities);
    const search = createSearchIndex([
      ...entities.students,
      ...entities.lecturers,
      ...entities.groups,
      ...entities.majors,
      ...entities.departments,
      ...entities.levels,
      ...entities.courses,
    ]);
    return {
      ...entities,
      index,
      search,
      loading,
      refresh,
      getById: index.getById,
      getStudentById: index.getStudentById,
      getLecturerById: index.getLecturerById,
      getGroupById: index.getGroupById,
      getMajorById: index.getMajorById,
      getDepartmentById: index.getDepartmentById,
      getLevelById: index.getLevelById,
      getCourseById: index.getCourseById,
      getByGroup: index.getByGroup,
      getByMajor: index.getByMajor,
      getByDepartment: index.getByDepartment,
      getByLevel: index.getByLevel,
      resolveAudience: (target) => resolveAudience({ ...entities, ...target }),
    };
  }, [entities, loading, refresh]);
  return <EntityContext.Provider value={value}>{children}</EntityContext.Provider>;
}

export function useEntities() {
  const context = useContext(EntityContext);
  if (!context) throw new Error('useEntities must be used within EntityProvider');
  return context;
}
