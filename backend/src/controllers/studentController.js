const { prisma } = require('../db');

exports.getStudentById = async (req, res) => {
  try {
    const studentId = parseInt(req.params.id);
    if (req.user.role !== 'SUPER_ADMIN' && req.user.id !== studentId) {
      return res.status(403).json({ success: false, error: 'Forbidden: You do not have permission to access this data' });
    }

    const student = await prisma.student.findUnique({
      where: { id: studentId },
      include: { college: true, major: true, level: true, group: true }
    });

    if (!student) {
      return res.status(404).json({ success: false, error: 'Student not found' });
    }

    res.status(200).json({ success: true, data: student });
  } catch (error) {
    console.error('[Student Controller] Error getting student:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
};

exports.updateStudentById = async (req, res) => {
  try {
    const studentId = parseInt(req.params.id);
    if (req.user.role !== 'SUPER_ADMIN' && req.user.id !== studentId) {
      return res.status(403).json({ success: false, error: 'Forbidden: You do not have permission to modify this data' });
    }

    const { name, phone } = req.body;
    
    const student = await prisma.student.update({
      where: { id: studentId },
      data: { name, phone }
    });

    res.status(200).json({ success: true, data: student });
  } catch (error) {
    console.error('[Student Controller] Error updating student:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
};
