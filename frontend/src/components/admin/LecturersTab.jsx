import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';
import { API_URL } from '../../config';

export default function LecturersTab({ isAr, token, isSuperAdmin }) {
  const [lecturers, setLecturers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingId, setEditingId] = useState(null);

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    phone: ''
  });

  const fetchLecturers = async () => {
    setLoading(true);
    try {
      let url = `${API_URL}/api/admin/lecturers`;
      if (isSuperAdmin) {
        const selCollegeId = localStorage.getItem('superadmin_selectedCollegeId');
        if (selCollegeId) url += `?collegeId=${selCollegeId}`;
      }
      const res = await axios.get(url, { headers: { Authorization: `Bearer ${token}` } });
      if (res.data?.success) {
        setLecturers(res.data.data);
      }
    } catch (error) {
      toast.error(isAr ? 'فشل تحميل بيانات المدرسين' : 'Failed to fetch lecturers');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLecturers();
  }, []);

  const handleOpenAdd = () => {
    setEditingId(null);
    setFormData({ name: '', email: '', password: '', phone: '' });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (lecturer) => {
    setEditingId(lecturer.id);
    setFormData({ name: lecturer.name, email: lecturer.email, password: '', phone: lecturer.phone || '' });
    setIsModalOpen(true);
  };

  const handleDelete = async (id) => {
    if (!window.confirm(isAr ? 'هل أنت متأكد من حذف هذا المدرس؟ سيتم حذف كافة الارتباطات.' : 'Are you sure you want to delete this lecturer?')) {
      return;
    }
    try {
      const res = await axios.delete(`${API_URL}/api/admin/god-mode/lecturers/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.data?.success) {
        toast.success(isAr ? 'تم حذف المدرس بنجاح' : 'Lecturer deleted successfully');
        fetchLecturers();
      }
    } catch (error) {
      toast.error(isAr ? 'فشل عملية الحذف' : 'Failed to delete lecturer');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      let url = `${API_URL}/api/admin/lecturers`;
      const payload = { ...formData };
      
      if (isSuperAdmin) {
        const selCollegeId = localStorage.getItem('superadmin_selectedCollegeId');
        if (selCollegeId) payload.collegeId = parseInt(selCollegeId);
      }

      if (editingId) {
        // Edit mode
        url += `/${editingId}`;
        const res = await axios.put(url, payload, { headers: { Authorization: `Bearer ${token}` } });
        if (res.data?.success) {
          toast.success(isAr ? 'تم تعديل البيانات بنجاح' : 'Lecturer updated successfully');
        }
      } else {
        // Create mode
        const res = await axios.post(url, payload, { headers: { Authorization: `Bearer ${token}` } });
        if (res.data?.success) {
          toast.success(isAr ? 'تم إضافة المدرس بنجاح' : 'Lecturer added successfully');
        }
      }
      setIsModalOpen(false);
      fetchLecturers();
    } catch (error) {
      toast.error(error.response?.data?.error || (isAr ? 'حدث خطأ أثناء الحفظ' : 'Failed to save lecturer'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in-up">
      <div className="flex justify-between items-center bg-slate-950 p-6 rounded-3xl border border-slate-800 shadow-xl">
        <div>
          <h2 className="text-xl font-black text-white mb-2">
            👨‍🏫 {isAr ? 'أعضاء هيئة التدريس' : 'Faculty & Lecturers'}
          </h2>
          <p className="text-sm text-slate-400">
            {isAr ? 'إدارة حسابات المدرسين وصلاحيات الدخول الخاصة بهم' : 'Manage faculty accounts and their access credentials'}
          </p>
        </div>
        <button
          onClick={handleOpenAdd}
          className="bg-amber-500 hover:bg-amber-600 text-slate-950 px-5 py-2.5 rounded-xl font-black transition-all shadow-lg shadow-amber-500/20 active:scale-95"
        >
          {isAr ? '+ إضافة مدرس جديد' : '+ Add New Lecturer'}
        </button>
      </div>

      <div className="bg-slate-950 rounded-3xl border border-slate-800 shadow-xl overflow-hidden min-h-[400px]">
        {loading ? (
          <div className="flex items-center justify-center h-48">
            <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : lecturers.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-slate-500">
            <span className="text-5xl mb-4">👨‍🏫</span>
            <p className="font-bold text-lg">{isAr ? 'لا يوجد مدرسين مسجلين بعد' : 'No lecturers found'}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left rtl:text-right text-slate-300">
              <thead className="text-xs text-slate-400 uppercase bg-slate-900 border-b border-slate-800">
                <tr>
                  <th className="px-6 py-4 font-black">{isAr ? 'اسم المدرس' : 'Lecturer Name'}</th>
                  <th className="px-6 py-4 font-black">{isAr ? 'البريد الإلكتروني' : 'Email'}</th>
                  <th className="px-6 py-4 font-black text-center">{isAr ? 'رقم الهاتف' : 'Phone'}</th>
                  <th className="px-6 py-4 font-black text-center">{isAr ? 'الإجراءات' : 'Actions'}</th>
                </tr>
              </thead>
              <tbody>
                {lecturers.map(lecturer => (
                  <tr key={lecturer.id} className="bg-slate-950 hover:bg-slate-900/50 border-b border-slate-800 transition-colors">
                    <td className="px-6 py-4 font-bold text-white">
                      {lecturer.name}
                    </td>
                    <td className="px-6 py-4 text-slate-400 font-mono text-xs">
                      {lecturer.email}
                    </td>
                    <td className="px-6 py-4 text-center text-slate-400">
                      {lecturer.phone || '-'}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-center gap-3">
                        <button
                          onClick={() => handleOpenEdit(lecturer)}
                          className="text-amber-500 hover:text-amber-400 font-bold px-3 py-1 bg-amber-500/10 rounded-lg transition-colors"
                        >
                          {isAr ? 'تعديل' : 'Edit'}
                        </button>
                        <button
                          onClick={() => handleDelete(lecturer.id)}
                          className="text-red-500 hover:text-red-400 font-bold px-3 py-1 bg-red-500/10 rounded-lg transition-colors"
                        >
                          {isAr ? 'حذف' : 'Delete'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-slate-950 border border-slate-800 rounded-3xl p-6 shadow-2xl w-full max-w-md space-y-6 text-white max-h-[90vh] overflow-y-auto"
            >
              <div className="flex justify-between items-center border-b border-slate-800 pb-3">
                <h3 className="text-sm font-black uppercase tracking-wider text-amber-400">
                  {editingId 
                    ? (isAr ? 'تعديل بيانات المدرس' : 'Edit Lecturer') 
                    : (isAr ? 'إضافة مدرس جديد' : 'Add New Lecturer')}
                </h3>
                <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-white text-lg">✕</button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4 text-sm font-bold">
                <div className="space-y-1">
                  <label className="text-slate-400">{isAr ? 'اسم المدرس' : 'Lecturer Name'}</label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={e => setFormData({...formData, name: e.target.value})}
                    placeholder={isAr ? 'الاسم كاملاً' : 'Full Name'}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl p-3 text-white focus:outline-none focus:border-amber-400"
                  />
                </div>
                
                <div className="space-y-1">
                  <label className="text-slate-400">{isAr ? 'البريد الإلكتروني' : 'Email Address'}</label>
                  <input
                    type="email"
                    required
                    value={formData.email}
                    onChange={e => setFormData({...formData, email: e.target.value})}
                    placeholder="lecturer@example.com"
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl p-3 text-white focus:outline-none focus:border-amber-400"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-slate-400">
                    {isAr ? 'كلمة المرور' : 'Password'} 
                    {editingId && <span className="text-xs text-slate-500 font-normal ms-2">({isAr ? 'اتركه فارغاً لعدم التغيير' : 'leave blank to keep unchanged'})</span>}
                  </label>
                  <input
                    type="password"
                    required={!editingId}
                    value={formData.password}
                    onChange={e => setFormData({...formData, password: e.target.value})}
                    placeholder="••••••••"
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl p-3 text-white focus:outline-none focus:border-amber-400"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-slate-400">{isAr ? 'رقم الهاتف (اختياري)' : 'Phone (Optional)'}</label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={e => setFormData({...formData, phone: e.target.value})}
                    placeholder={isAr ? 'رقم الواتساب أو الهاتف' : 'Phone Number'}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl p-3 text-white focus:outline-none focus:border-amber-400"
                  />
                </div>

                <div className="pt-4 flex gap-3">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 text-white rounded-xl transition-colors"
                  >
                    {isAr ? 'إلغاء' : 'Cancel'}
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="flex-1 py-3 bg-amber-500 hover:bg-amber-600 text-slate-950 rounded-xl transition-colors disabled:opacity-50"
                  >
                    {isSubmitting 
                      ? (isAr ? 'جاري الحفظ...' : 'Saving...') 
                      : (isAr ? 'حفظ البيانات' : 'Save Details')}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
