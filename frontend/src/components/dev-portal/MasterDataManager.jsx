import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'react-hot-toast';

export default function MasterDataManager({ API_URL, token, isAr }) {
  const [activeTab, setActiveTab] = useState('STUDENTS'); // STUDENTS, LECTURERS, ROOMS, MAJORS, SUBJECTS, LEVELS
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  
  // Modal / Form States
  const [showModal, setShowModal] = useState(false);
  const [editId, setEditId] = useState(null);
  const [formData, setFormData] = useState({});

  // Help selections
  const [colleges, setColleges] = useState([]);
  const [majors, setMajors] = useState([]);
  const [levels, setLevels] = useState([]);
  const [groups, setGroups] = useState([]);

  const tabs = [
    { id: 'STUDENTS', labelAr: 'الطلاب 👨‍🎓', labelEn: 'Students' },
    { id: 'LECTURERS', labelAr: 'المحاضرين 👨‍🏫', labelEn: 'Lecturers' },
    { id: 'ROOMS', labelAr: 'القاعات 🏢', labelEn: 'Rooms' },
    { id: 'MAJORS', labelAr: 'التخصصات 🎓', labelEn: 'Majors' },
    { id: 'SUBJECTS', labelAr: 'المواد 📚', labelEn: 'Subjects' },
    { id: 'LEVELS', labelAr: 'المستويات 📊', labelEn: 'Levels' }
  ];

  const fetchData = async () => {
    setLoading(true);
    try {
      let endpoint = '';
      if (activeTab === 'STUDENTS') endpoint = '/api/admin/students';
      else if (activeTab === 'LECTURERS') endpoint = '/api/admin/lecturers';
      else if (activeTab === 'ROOMS') endpoint = '/api/admin/rooms';
      else if (activeTab === 'MAJORS') endpoint = '/api/admin/majors';
      else if (activeTab === 'SUBJECTS') endpoint = '/api/admin/subjects';
      else if (activeTab === 'LEVELS') endpoint = '/api/admin/levels';

      const res = await axios.get(`${API_URL}${endpoint}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.data?.success) {
        setData(res.data.data || []);
      }
    } catch (err) {
      toast.error(isAr ? 'فشل تحميل البيانات' : 'Failed to fetch entity data');
    } finally {
      setLoading(false);
    }
  };

  const fetchHelpers = async () => {
    try {
      const colRes = await axios.get(`${API_URL}/api/admin/colleges`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (colRes.data?.success) setColleges(colRes.data.data || []);

      const majRes = await axios.get(`${API_URL}/api/admin/majors`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (majRes.data?.success) setMajors(majRes.data.data || []);

      const levRes = await axios.get(`${API_URL}/api/admin/levels`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (levRes.data?.success) setLevels(levRes.data.data || []);

      const grpRes = await axios.get(`${API_URL}/api/groups`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (grpRes.data?.success) setGroups(grpRes.data.data || []);
    } catch (err) {
      console.warn('Helpers fetch error:', err.message);
    }
  };

  useEffect(() => {
    fetchData();
  }, [activeTab]);

  useEffect(() => {
    fetchHelpers();
  }, []);

  const handleEditClick = (item) => {
    setEditId(item.id);
    if (activeTab === 'STUDENTS') {
      setFormData({
        name: item.name,
        email: item.email,
        academicId: item.academicId,
        majorId: item.majorId,
        levelId: item.levelId,
        groupId: item.groupId,
        collegeId: item.collegeId
      });
    } else if (activeTab === 'LECTURERS') {
      setFormData({
        name: item.name,
        email: item.email,
        collegeId: item.collegeId
      });
    } else if (activeTab === 'ROOMS') {
      setFormData({
        name: item.name,
        capacity: item.capacity,
        type: item.type,
        collegeId: item.collegeId
      });
    } else if (activeTab === 'MAJORS') {
      setFormData({
        name: item.name,
        code: item.code,
        collegeId: item.collegeId
      });
    } else if (activeTab === 'SUBJECTS') {
      setFormData({
        name: item.name,
        code: item.code,
        type: item.type,
        collegeId: item.collegeId
      });
    } else if (activeTab === 'LEVELS') {
      setFormData({
        name: item.name
      });
    }
    setShowModal(true);
  };

  const handleCreateClick = () => {
    setEditId(null);
    setFormData({});
    setShowModal(true);
  };

  const handleDelete = async (id) => {
    if (!window.confirm(isAr ? 'هل أنت متأكد من حذف هذا العنصر نهائياً؟' : 'Are you sure you want to delete this item?')) return;
    try {
      let endpoint = '';
      if (activeTab === 'STUDENTS') endpoint = `/api/admin/students/${id}`;
      else if (activeTab === 'LECTURERS') endpoint = `/api/admin/lecturers/${id}`;
      else if (activeTab === 'ROOMS') endpoint = `/api/admin/rooms/${id}`;
      else if (activeTab === 'MAJORS') endpoint = `/api/admin/majors/${id}`;
      else if (activeTab === 'SUBJECTS') endpoint = `/api/admin/subjects/${id}`;
      else if (activeTab === 'LEVELS') endpoint = `/api/admin/levels/${id}`;

      const res = await axios.delete(`${API_URL}${endpoint}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.data?.success) {
        toast.success(isAr ? 'تم الحذف بنجاح' : 'Deleted successfully');
        fetchData();
      }
    } catch (err) {
      toast.error(err.response?.data?.error || (isAr ? 'فشل عملية الحذف' : 'Failed to delete'));
    }
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    try {
      let endpoint = '';
      if (activeTab === 'STUDENTS') endpoint = '/api/admin/students';
      else if (activeTab === 'LECTURERS') endpoint = '/api/admin/lecturers';
      else if (activeTab === 'ROOMS') endpoint = '/api/admin/rooms';
      else if (activeTab === 'MAJORS') endpoint = '/api/admin/majors';
      else if (activeTab === 'SUBJECTS') endpoint = '/api/admin/subjects';
      else if (activeTab === 'LEVELS') endpoint = '/api/admin/levels';

      const payload = { ...formData };
      if (editId) payload.id = editId;

      const res = await axios.post(`${API_URL}${endpoint}`, payload, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (res.data?.success) {
        toast.success(isAr ? 'تم حفظ التعديلات بنجاح' : 'Changes saved successfully');
        setShowModal(false);
        fetchData();
      }
    } catch (err) {
      toast.error(err.response?.data?.error || (isAr ? 'فشل حفظ التعديلات' : 'Failed to save changes'));
    }
  };

  const filteredData = data.filter(item => {
    if (!search.trim()) return true;
    const term = search.toLowerCase();
    return (
      (item.name && item.name.toLowerCase().includes(term)) ||
      (item.email && item.email.toLowerCase().includes(term)) ||
      (item.code && item.code.toLowerCase().includes(term)) ||
      (item.academicId && item.academicId.toLowerCase().includes(term))
    );
  });

  return (
    <div className="bg-slate-900/60 backdrop-blur-xl border border-sky-500/20 rounded-2xl p-6 shadow-2xl">
      {/* Tabs */}
      <div className="flex flex-wrap gap-2 mb-6 border-b border-slate-800 pb-4">
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => { setActiveTab(t.id); setSearch(''); }}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition duration-150 ${
              activeTab === t.id
                ? 'bg-sky-500 text-white shadow-lg shadow-sky-500/25'
                : 'bg-slate-950 border border-slate-800 text-slate-400 hover:text-white'
            }`}
          >
            {isAr ? t.labelAr : t.labelEn}
          </button>
        ))}
      </div>

      {/* Toolbar */}
      <div className="flex flex-col md:flex-row justify-between items-center gap-4 mb-6">
        <input
          type="text"
          placeholder={isAr ? 'البحث بالاسم، الكود أو البريد الإلكتروني...' : 'Search...'}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full md:w-80 bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-sky-500/50"
        />

        <button
          onClick={handleCreateClick}
          className="w-full md:w-auto px-5 py-2.5 bg-sky-500 hover:bg-sky-400 text-white text-xs font-bold rounded-xl shadow-lg transition"
        >
          {isAr ? '➕ إضافة عنصر جديد' : '+ Create New'}
        </button>
      </div>

      {/* Grid */}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-slate-800 text-[11px] font-bold text-slate-400 uppercase">
              <th className="pb-3 text-right md:text-left">{isAr ? 'الاسم المعرّف' : 'Name / Details'}</th>
              <th className="pb-3">{isAr ? 'الترميز / المعرف' : 'Code / ID'}</th>
              <th className="pb-3">{isAr ? 'الكلية التابع لها' : 'College'}</th>
              <th className="pb-3 text-center">{isAr ? 'العمليات' : 'Actions'}</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan="4" className="text-center py-10 text-xs text-slate-400">
                  {isAr ? 'جاري التحميل...' : 'Loading...'}
                </td>
              </tr>
            ) : filteredData.length === 0 ? (
              <tr>
                <td colSpan="4" className="text-center py-10 text-xs text-slate-500">
                  {isAr ? 'لا توجد بيانات مسجلة' : 'No data found'}
                </td>
              </tr>
            ) : (
              filteredData.map(item => (
                <tr key={item.id} className="border-b border-slate-800/50 hover:bg-slate-800/10 text-xs text-slate-300">
                  <td className="py-4 text-right md:text-left font-sans">
                    <div className="font-bold text-white">{item.name}</div>
                    {item.email && <div className="text-[10px] text-slate-500 font-mono mt-0.5">{item.email}</div>}
                    {activeTab === 'STUDENTS' && (
                      <div className="text-[9px] text-[var(--accent)] font-bold mt-1">
                        {item.major?.name || '-'} · {item.level?.name || '-'} {item.group ? `· ${isAr ? 'الشعبة' : 'Group'}: ${item.group.name}` : ''}
                      </div>
                    )}
                    {item.capacity && <div className="text-[10px] text-slate-400 font-mono mt-0.5">{isAr ? `السعة: ${item.capacity}` : `Capacity: ${item.capacity}`}</div>}
                  </td>
                  <td className="py-4 font-mono text-[10px] text-slate-400">
                    {item.code || item.academicId || item.id}
                  </td>
                  <td className="py-4 text-slate-400">
                    {item.college?.name || item.collegeId || '-'}
                  </td>
                  <td className="py-4 text-center space-x-2">
                    <button
                      onClick={() => handleEditClick(item)}
                      className="px-2.5 py-1 bg-sky-500/10 hover:bg-sky-500/20 text-sky-400 border border-sky-500/30 rounded-lg text-[10px] font-bold"
                    >
                      {isAr ? 'تعديل' : 'Edit'}
                    </button>
                    <button
                      onClick={() => handleDelete(item.id)}
                      className="px-2.5 py-1 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 rounded-lg text-[10px] font-bold"
                    >
                      {isAr ? 'حذف' : 'Delete'}
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 shadow-2xl">
            <h4 className="text-sm font-bold text-white mb-4">
              {editId ? (isAr ? 'تعديل الكيان الحالي' : 'Edit Entity') : (isAr ? 'إنشاء كيان جديد' : 'Create New')}
            </h4>

            <form onSubmit={handleFormSubmit} className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">{isAr ? 'الاسم' : 'Name'}</label>
                <input
                  type="text"
                  required
                  value={formData.name || ''}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white"
                />
              </div>

              {activeTab === 'STUDENTS' && (
                <>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">{isAr ? 'البريد الإلكتروني' : 'Email'}</label>
                    <input
                      type="email"
                      required
                      value={formData.email || ''}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">{isAr ? 'الرقم الجامعي (Academic ID)' : 'Academic ID'}</label>
                    <input
                      type="text"
                      required
                      value={formData.academicId || ''}
                      onChange={(e) => setFormData({ ...formData, academicId: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">{isAr ? 'التخصص' : 'Major'}</label>
                    <select
                      value={formData.majorId || ''}
                      onChange={(e) => setFormData({ ...formData, majorId: parseInt(e.target.value) })}
                      required
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white"
                    >
                      <option value="">-- Choose Major --</option>
                      {majors
                        .filter(m => !formData.collegeId || m.collegeId === formData.collegeId)
                        .map(m => <option key={m.id} value={m.id}>{m.name}</option>)
                      }
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">{isAr ? 'المستوى الدراسي' : 'Level'}</label>
                    <select
                      value={formData.levelId || ''}
                      onChange={(e) => setFormData({ ...formData, levelId: parseInt(e.target.value) })}
                      required
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white"
                    >
                      <option value="">-- Choose Level --</option>
                      {levels.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">{isAr ? 'الشعبة' : 'Group (Class)'}</label>
                    <select
                      value={formData.groupId || ''}
                      onChange={(e) => setFormData({ ...formData, groupId: e.target.value ? parseInt(e.target.value) : null })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white"
                    >
                      <option value="">-- None / Select Group --</option>
                      {groups
                        .filter(g => !formData.collegeId || g.collegeId === formData.collegeId)
                        .map(g => <option key={g.id} value={g.id}>{g.name}</option>)
                      }
                    </select>
                  </div>
                  {!editId && (
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">{isAr ? 'كلمة المرور' : 'Password'}</label>
                      <input
                        type="password"
                        placeholder="Default: 12345678"
                        value={formData.password || ''}
                        onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white"
                      />
                    </div>
                  )}
                </>
              )}

              {activeTab === 'LECTURERS' && (
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">{isAr ? 'البريد الإلكتروني' : 'Email'}</label>
                  <input
                    type="email"
                    required
                    value={formData.email || ''}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white"
                  />
                </div>
              )}

              {activeTab === 'ROOMS' && (
                <>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">{isAr ? 'السعة الاستيعابية' : 'Capacity'}</label>
                    <input
                      type="number"
                      required
                      value={formData.capacity || ''}
                      onChange={(e) => setFormData({ ...formData, capacity: parseInt(e.target.value) })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">{isAr ? 'نوع القاعة' : 'Type'}</label>
                    <input
                      type="text"
                      placeholder="LECTURE_HALL / LAB / CLASSROOM"
                      value={formData.type || ''}
                      onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white"
                    />
                  </div>
                </>
              )}

              {activeTab === 'MAJORS' && (
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">{isAr ? 'الرمز التعريفي (Code)' : 'Code'}</label>
                  <input
                    type="text"
                    required
                    value={formData.code || ''}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white"
                  />
                </div>
              )}

              {activeTab === 'SUBJECTS' && (
                <>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">{isAr ? 'كود المادة (Code)' : 'Code'}</label>
                    <input
                      type="text"
                      required
                      value={formData.code || ''}
                      onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">{isAr ? 'نوع المادة' : 'Type'}</label>
                    <input
                      type="text"
                      placeholder="THEORY / PRACTICAL / COMBINED"
                      value={formData.type || ''}
                      onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white"
                    />
                  </div>
                </>
              )}

              {/* College dropdown for college-associated entities */}
              {['STUDENTS', 'LECTURERS', 'ROOMS', 'MAJORS', 'SUBJECTS'].includes(activeTab) && (
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">{isAr ? 'الكلية' : 'College'}</label>
                  <select
                    value={formData.collegeId || ''}
                    onChange={(e) => setFormData({ ...formData, collegeId: parseInt(e.target.value) })}
                    required
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white"
                  >
                    <option value="">-- Choose College --</option>
                    {colleges.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
              )}

              <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 bg-slate-950 border border-slate-800 text-slate-400 hover:text-white rounded-xl text-xs font-bold transition"
                >
                  {isAr ? 'إلغاء' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-sky-500 hover:bg-sky-400 text-white rounded-xl text-xs font-bold shadow-lg shadow-sky-500/25 transition"
                >
                  {isAr ? 'حفظ الكيان' : 'Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
