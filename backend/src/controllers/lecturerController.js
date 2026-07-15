const { prisma } = require('../db');

exports.getLecturerById = async (req, res) => {
  try {
    const lecturerId = parseInt(req.params.id);
    if (req.user.role !== 'SUPER_ADMIN' && req.user.id !== lecturerId) {
      return res.status(403).json({ success: false, error: 'Forbidden: You do not have permission to access this data' });
    }

    const lecturer = await prisma.lecturer.findUnique({
      where: { id: lecturerId },
      include: { college: true, department: true }
    });

    if (!lecturer) {
      return res.status(404).json({ success: false, error: 'Lecturer not found' });
    }

    res.status(200).json({ success: true, data: lecturer });
  } catch (error) {
    console.error('[Lecturer Controller] Error getting lecturer:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
};

exports.updateLecturerById = async (req, res) => {
  try {
    const lecturerId = parseInt(req.params.id);
    if (req.user.role !== 'SUPER_ADMIN' && req.user.id !== lecturerId) {
      return res.status(403).json({ success: false, error: 'Forbidden: You do not have permission to modify this data' });
    }

    const { name, phone } = req.body;
    
    const lecturer = await prisma.lecturer.update({
      where: { id: lecturerId },
      data: { name, phone }
    });

    res.status(200).json({ success: true, data: lecturer });
  } catch (error) {
    console.error('[Lecturer Controller] Error updating lecturer:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
};
